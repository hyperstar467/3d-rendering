import * as THREE from "three";
import type {
  GeometryModifier,
  GeometrySource,
  MaterialRegion,
  PathDefinition,
  SketchDefinition,
  Vector2Mm,
} from "@/studio/domain/types";

export type BuiltGeometry = { geometry: THREE.BufferGeometry; regions: MaterialRegion[] };

const mm = (value: number) => value / 1000;

function sketchToShape(sketch: SketchDefinition) {
  const shape = new THREE.Shape();
  if (sketch.kind === "rectangle") {
    const w = mm(sketch.width) / 2;
    const h = mm(sketch.height) / 2;
    shape.moveTo(-w, -h);
    shape.lineTo(w, -h);
    shape.lineTo(w, h);
    shape.lineTo(-w, h);
    shape.closePath();
  } else if (sketch.kind === "circle") {
    shape.absarc(0, 0, mm(sketch.radius), 0, Math.PI * 2, false);
  } else if (sketch.kind === "polygon") {
    const [first, ...rest] = sketch.points;
    if (!first || rest.length < 2) throw new Error("닫힌 Polygon에는 최소 3개의 Point가 필요합니다.");
    shape.moveTo(mm(first.x), mm(first.y));
    rest.forEach((point) => shape.lineTo(mm(point.x), mm(point.y)));
    shape.closePath();
  } else {
    shape.moveTo(mm(sketch.start.x), mm(sketch.start.y));
    sketch.curves.forEach((curve) => shape.bezierCurveTo(
      mm(curve.control1.x),
      mm(curve.control1.y),
      mm(curve.control2.x),
      mm(curve.control2.y),
      mm(curve.end.x),
      mm(curve.end.y),
    ));
    shape.closePath();
  }
  return shape;
}

function pathToCurve(path: PathDefinition) {
  const points = path.points.map((point) => new THREE.Vector3(mm(point.x), mm(point.y), mm(point.z)));
  if (points.length < 2) throw new Error("Path에는 최소 2개의 Point가 필요합니다.");
  if (path.curve === "catmull-rom") return new THREE.CatmullRomCurve3(points, path.closed, "centripetal");
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let index = 1; index < points.length; index += 1) curve.add(new THREE.LineCurve3(points[index - 1], points[index]));
  if (path.closed) curve.add(new THREE.LineCurve3(points.at(-1)!, points[0]));
  return curve;
}

function oneRegion(geometry: THREE.BufferGeometry, id = "surface", label = "전체") {
  const count = geometry.index?.count ?? geometry.getAttribute("position").count;
  geometry.clearGroups();
  geometry.addGroup(0, count, 0);
  return { geometry, regions: [{ id, label }] };
}

function classifyExtrudeRegions(geometry: THREE.BufferGeometry, depth: number) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute("position");
  const backZ = mm(depth);
  source.clearGroups();
  for (let index = 0; index < position.count; index += 3) {
    const average = (position.getZ(index) + position.getZ(index + 1) + position.getZ(index + 2)) / 3;
    const materialIndex = Math.abs(average) < 0.00001 ? 0 : Math.abs(average - backZ) < 0.00001 ? 1 : 2;
    source.addGroup(index, 3, materialIndex);
  }
  source.translate(0, 0, -backZ / 2);
  return {
    geometry: source,
    regions: [
      { id: "front", label: "앞" },
      { id: "back", label: "뒤" },
      { id: "side", label: "측면" },
    ],
  };
}

function applyBend(geometry: THREE.BufferGeometry, modifier: Extract<GeometryModifier, { kind: "bend" }>) {
  if (!modifier.enabled || Math.abs(modifier.angle) < 0.001) return geometry;
  const next = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = next.getAttribute("position") as THREE.BufferAttribute;
  next.computeBoundingBox();
  const box = next.boundingBox!;
  const axis = modifier.axis;
  const min = box.min[axis];
  const max = box.max[axis];
  const span = Math.max(max - min, 0.00001);
  const center = (min + max) / 2;
  const totalAngle = THREE.MathUtils.degToRad(modifier.angle);
  const activeSpan = Math.max(span * THREE.MathUtils.clamp(modifier.range ?? 1, 0.05, 1), 0.00001);
  const halfActive = activeSpan / 2;
  const radius = Math.max(mm(modifier.radius), 0.0001);

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const coordinate = axis === "x" ? x : axis === "y" ? y : z;
    const relative = coordinate - center;
    const curvedCoordinate = THREE.MathUtils.clamp(relative, -halfActive, halfActive);
    const extension = relative - curvedCoordinate;
    const theta = (curvedCoordinate / activeSpan) * totalAngle;
    if (axis === "x") {
      position.setX(index, Math.sin(theta) * (radius + z) + Math.cos(theta) * extension);
      position.setZ(index, Math.cos(theta) * (radius + z) - radius - Math.sin(theta) * extension);
    } else if (axis === "y") {
      position.setY(index, Math.sin(theta) * (radius + z) + Math.cos(theta) * extension);
      position.setZ(index, Math.cos(theta) * (radius + z) - radius - Math.sin(theta) * extension);
    } else {
      position.setZ(index, Math.sin(theta) * (radius + x) + Math.cos(theta) * extension);
      position.setX(index, Math.cos(theta) * (radius + x) - radius - Math.sin(theta) * extension);
    }
  }
  position.needsUpdate = true;
  next.computeVertexNormals();
  next.computeBoundingBox();
  next.computeBoundingSphere();
  return next;
}

export function buildGeometry(source: Exclude<GeometrySource, { kind: "glb" }>, modifiers: GeometryModifier[] = []): BuiltGeometry {
  let built: BuiltGeometry;
  if (source.kind === "primitive") {
    if (source.primitive === "box") {
      built = {
        geometry: new THREE.BoxGeometry(mm(source.width), mm(source.height), mm(source.depth)),
        regions: [
          { id: "right", label: "오른쪽" }, { id: "left", label: "왼쪽" },
          { id: "top", label: "위" }, { id: "bottom", label: "아래" },
          { id: "front", label: "앞" }, { id: "back", label: "뒤" },
        ],
      };
    } else if (source.primitive === "sphere") {
      built = oneRegion(new THREE.SphereGeometry(mm(source.radius), source.segments, Math.max(12, Math.round(source.segments / 2))));
    } else if (source.primitive === "bar") {
      built = {
        geometry: new THREE.BoxGeometry(mm(source.width), mm(source.length), mm(source.height)),
        regions: [
          { id: "right", label: "오른쪽" }, { id: "left", label: "왼쪽" },
          { id: "top", label: "위" }, { id: "bottom", label: "아래" },
          { id: "front", label: "앞" }, { id: "back", label: "뒤" },
        ],
      };
    } else {
      const radius = mm(source.radius);
      const height = mm(source.primitive === "rod" ? source.length : source.height);
      const topRadius = source.primitive === "cone" ? 0 : radius;
      built = {
        geometry: new THREE.CylinderGeometry(topRadius, radius, height, source.segments),
        regions: [
          { id: "side", label: "측면" },
          { id: "top", label: "위" },
          { id: "bottom", label: "아래" },
        ],
      };
    }
  } else if (source.kind === "extrude") {
    built = classifyExtrudeRegions(new THREE.ExtrudeGeometry(sketchToShape(source.sketch), {
      depth: mm(source.depth),
      bevelEnabled: false,
      curveSegments: 32,
      steps: 1,
    }), source.depth);
  } else if (source.kind === "sweep") {
    const path = pathToCurve(source.path);
    if (source.crossSection.kind === "circle") {
      built = oneRegion(new THREE.TubeGeometry(path, Math.max(24, source.path.points.length * 12), mm(source.crossSection.radius), source.crossSection.segments, source.path.closed));
    } else {
      const shape = new THREE.Shape();
      const width = mm(source.crossSection.width) / 2;
      const height = mm(source.crossSection.height) / 2;
      shape.moveTo(-width, -height);
      shape.lineTo(width, -height);
      shape.lineTo(width, height);
      shape.lineTo(-width, height);
      shape.closePath();
      built = oneRegion(new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, steps: Math.max(16, source.path.points.length * 8), extrudePath: path }));
    }
  } else {
    const profile = source.profile.length >= 2 ? source.profile : [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const points = profile.map((point: Vector2Mm) => new THREE.Vector2(Math.max(0, mm(point.x)), mm(point.y)));
    built = oneRegion(new THREE.LatheGeometry(points, source.segments, 0, THREE.MathUtils.degToRad(source.angle)));
  }

  let geometry = built.geometry;
  modifiers.forEach((modifier) => {
    const previous = geometry;
    geometry = applyBend(geometry, modifier);
    if (previous !== geometry) previous.dispose();
  });
  geometry.computeVertexNormals();
  return { geometry, regions: built.regions };
}

export function geometryRegions(source: GeometrySource): MaterialRegion[] {
  if (source.kind === "glb") return [{ id: "original", label: "원본 재질" }];
  const built = buildGeometry(source);
  const regions = built.regions;
  built.geometry.dispose();
  return regions;
}

export function materialRegionAspect(source: GeometrySource, regionId: string) {
  if (source.kind === "primitive" && (source.primitive === "box" || source.primitive === "bar")) {
    const width = source.width;
    const vertical = source.primitive === "box" ? source.height : source.length;
    const depth = source.primitive === "box" ? source.depth : source.height;
    if (regionId === "right" || regionId === "left") return depth / Math.max(vertical, 1);
    if (regionId === "top" || regionId === "bottom") return width / Math.max(depth, 1);
    return width / Math.max(vertical, 1);
  }
  if (source.kind === "primitive" && source.primitive !== "sphere") {
    const height = source.primitive === "rod" ? source.length : source.height;
    return regionId === "side" ? (Math.PI * source.radius * 2) / Math.max(height, 1) : 1;
  }
  if (source.kind === "extrude") {
    if (regionId === "side") return 1;
    if (source.sketch.kind === "rectangle") return source.sketch.width / Math.max(source.sketch.height, 1);
    if (source.sketch.kind === "circle") return 1;
    const points = source.sketch.kind === "polygon"
      ? source.sketch.points
      : [source.sketch.start, ...source.sketch.curves.flatMap((curve) => [curve.control1, curve.control2, curve.end])];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return (Math.max(...xs) - Math.min(...xs)) / Math.max(Math.max(...ys) - Math.min(...ys), 1);
  }
  return 1;
}

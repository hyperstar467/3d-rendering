(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,36396,e=>{"use strict";let t,i;var r=e.i(56438),n=e.i(97566),o=e.i(20756),a=e.i(92115),s=e.i(6399),l=e.i(70887),d=l,c=l;let f=new c.Box3,h=new c.Vector3;class u extends c.InstancedBufferGeometry{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry",this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute("position",new c.Float32BufferAttribute([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute("uv",new c.Float32BufferAttribute([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,i=this.attributes.instanceEnd;return void 0!==t&&(t.applyMatrix4(e),i.applyMatrix4(e),t.needsUpdate=!0),null!==this.boundingBox&&this.computeBoundingBox(),null!==this.boundingSphere&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let i=new c.InstancedInterleavedBuffer(t,6,1);return this.setAttribute("instanceStart",new c.InterleavedBufferAttribute(i,3,0)),this.setAttribute("instanceEnd",new c.InterleavedBufferAttribute(i,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let i;e instanceof Float32Array?i=e:Array.isArray(e)&&(i=new Float32Array(e));let r=new c.InstancedInterleavedBuffer(i,2*t,1);return this.setAttribute("instanceColorStart",new c.InterleavedBufferAttribute(r,t,0)),this.setAttribute("instanceColorEnd",new c.InterleavedBufferAttribute(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new c.WireframeGeometry(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){null===this.boundingBox&&(this.boundingBox=new c.Box3);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;void 0!==e&&void 0!==t&&(this.boundingBox.setFromBufferAttribute(e),f.setFromBufferAttribute(t),this.boundingBox.union(f))}computeBoundingSphere(){null===this.boundingSphere&&(this.boundingSphere=new c.Sphere),null===this.boundingBox&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(void 0!==e&&void 0!==t){let i=this.boundingSphere.center;this.boundingBox.getCenter(i);let r=0;for(let n=0,o=e.count;n<o;n++)h.fromBufferAttribute(e,n),r=Math.max(r,i.distanceToSquared(h)),h.fromBufferAttribute(t,n),r=Math.max(r,i.distanceToSquared(h));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}applyMatrix(e){return console.warn("THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4()."),this.applyMatrix4(e)}}var p=l,m=e.i(52971),x=e.i(48828);class g extends p.ShaderMaterial{constructor(e){super({type:"LineMaterial",uniforms:p.UniformsUtils.clone(p.UniformsUtils.merge([m.UniformsLib.common,m.UniformsLib.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new p.Vector2(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${x.version>=154?"colorspace_fragment":"encodings_fragment"}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA="1":delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return"WORLD_UNITS"in this.defines},set:function(e){!0===e?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return"USE_DASH"in this.defines},set(e){!!e!="USE_DASH"in this.defines&&(this.needsUpdate=!0),!0===e?this.defines.USE_DASH="":delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return"USE_ALPHA_TO_COVERAGE"in this.defines},set:function(e){!!e!="USE_ALPHA_TO_COVERAGE"in this.defines&&(this.needsUpdate=!0),!0===e?(this.defines.USE_ALPHA_TO_COVERAGE="",this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}}let v=x.version>=125?"uv1":"uv2",y=new d.Vector4,S=new d.Vector3,w=new d.Vector3,b=new d.Vector4,M=new d.Vector4,j=new d.Vector4,E=new d.Vector3,A=new d.Matrix4,U=new d.Line3,_=new d.Vector3,L=new d.Box3,C=new d.Sphere,z=new d.Vector4;function P(e,t,r){return z.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),z.multiplyScalar(1/z.w),z.x=i/r.width,z.y=i/r.height,z.applyMatrix4(e.projectionMatrixInverse),z.multiplyScalar(1/z.w),Math.abs(Math.max(z.x,z.y))}class B extends d.Mesh{constructor(e=new u,t=new g({color:0xffffff*Math.random()})){super(e,t),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,i=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,n=0,o=t.count;e<o;e++,n+=2)S.fromBufferAttribute(t,e),w.fromBufferAttribute(i,e),r[n]=0===n?0:r[n-1],r[n+1]=r[n]+S.distanceTo(w);let n=new d.InstancedInterleavedBuffer(r,2,1);return e.setAttribute("instanceDistanceStart",new d.InterleavedBufferAttribute(n,1,0)),e.setAttribute("instanceDistanceEnd",new d.InterleavedBufferAttribute(n,1,1)),this}raycast(e,r){let n,o,a=this.material.worldUnits,s=e.camera;null!==s||a||console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');let l=void 0!==e.params.Line2&&e.params.Line2.threshold||0;t=e.ray;let c=this.matrixWorld,f=this.geometry,h=this.material;if(i=h.linewidth+l,null===f.boundingSphere&&f.computeBoundingSphere(),C.copy(f.boundingSphere).applyMatrix4(c),a)n=.5*i;else{let e=Math.max(s.near,C.distanceToPoint(t.origin));n=P(s,e,h.resolution)}if(C.radius+=n,!1!==t.intersectsSphere(C)){if(null===f.boundingBox&&f.computeBoundingBox(),L.copy(f.boundingBox).applyMatrix4(c),a)o=.5*i;else{let e=Math.max(s.near,L.distanceToPoint(t.origin));o=P(s,e,h.resolution)}L.expandByScalar(o),!1!==t.intersectsBox(L)&&(a?function(e,r){let n=e.matrixWorld,o=e.geometry,a=o.attributes.instanceStart,s=o.attributes.instanceEnd,l=Math.min(o.instanceCount,a.count);for(let o=0;o<l;o++){U.start.fromBufferAttribute(a,o),U.end.fromBufferAttribute(s,o),U.applyMatrix4(n);let l=new d.Vector3,c=new d.Vector3;t.distanceSqToSegment(U.start,U.end,c,l),c.distanceTo(l)<.5*i&&r.push({point:c,pointOnLine:l,distance:t.origin.distanceTo(c),object:e,face:null,faceIndex:o,uv:null,[v]:null})}}(this,r):function(e,r,n){let o=r.projectionMatrix,a=e.material.resolution,s=e.matrixWorld,l=e.geometry,c=l.attributes.instanceStart,f=l.attributes.instanceEnd,h=Math.min(l.instanceCount,c.count),u=-r.near;t.at(1,j),j.w=1,j.applyMatrix4(r.matrixWorldInverse),j.applyMatrix4(o),j.multiplyScalar(1/j.w),j.x*=a.x/2,j.y*=a.y/2,j.z=0,E.copy(j),A.multiplyMatrices(r.matrixWorldInverse,s);for(let r=0;r<h;r++){if(b.fromBufferAttribute(c,r),M.fromBufferAttribute(f,r),b.w=1,M.w=1,b.applyMatrix4(A),M.applyMatrix4(A),b.z>u&&M.z>u)continue;if(b.z>u){let e=b.z-M.z,t=(b.z-u)/e;b.lerp(M,t)}else if(M.z>u){let e=M.z-b.z,t=(M.z-u)/e;M.lerp(b,t)}b.applyMatrix4(o),M.applyMatrix4(o),b.multiplyScalar(1/b.w),M.multiplyScalar(1/M.w),b.x*=a.x/2,b.y*=a.y/2,M.x*=a.x/2,M.y*=a.y/2,U.start.copy(b),U.start.z=0,U.end.copy(M),U.end.z=0;let l=U.closestPointToPointParameter(E,!0);U.at(l,_);let h=d.MathUtils.lerp(b.z,M.z,l),p=h>=-1&&h<=1,m=E.distanceTo(_)<.5*i;if(p&&m){U.start.fromBufferAttribute(c,r),U.end.fromBufferAttribute(f,r),U.start.applyMatrix4(s),U.end.applyMatrix4(s);let i=new d.Vector3,o=new d.Vector3;t.distanceSqToSegment(U.start,U.end,o,i),n.push({point:o,pointOnLine:i,distance:t.origin.distanceTo(o),object:e,face:null,faceIndex:r,uv:null,[v]:null})}}}(this,s,r))}}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(y),this.material.uniforms.resolution.value.set(y.z,y.w))}}class T extends u{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(e){let t=e.length-3,i=new Float32Array(2*t);for(let r=0;r<t;r+=3)i[2*r]=e[r],i[2*r+1]=e[r+1],i[2*r+2]=e[r+2],i[2*r+3]=e[r+3],i[2*r+4]=e[r+4],i[2*r+5]=e[r+5];return super.setPositions(i),this}setColors(e,t=3){let i=e.length-t,r=new Float32Array(2*i);if(3===t)for(let n=0;n<i;n+=t)r[2*n]=e[n],r[2*n+1]=e[n+1],r[2*n+2]=e[n+2],r[2*n+3]=e[n+3],r[2*n+4]=e[n+4],r[2*n+5]=e[n+5];else for(let n=0;n<i;n+=t)r[2*n]=e[n],r[2*n+1]=e[n+1],r[2*n+2]=e[n+2],r[2*n+3]=e[n+3],r[2*n+4]=e[n+4],r[2*n+5]=e[n+5],r[2*n+6]=e[n+6],r[2*n+7]=e[n+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}}class O extends B{constructor(e=new T,t=new g({color:0xffffff*Math.random()})){super(e,t),this.isLine2=!0,this.type="Line2"}}let G=n.forwardRef(function({points:e,color:t=0xffffff,vertexColors:i,linewidth:r,lineWidth:o,segments:d,dashed:c,...f},h){var p,m;let x=(0,a.useThree)(e=>e.size),v=n.useMemo(()=>d?new B:new O,[d]),[y]=n.useState(()=>new g),S=(null==i||null==(p=i[0])?void 0:p.length)===4?4:3,w=n.useMemo(()=>{let r=d?new u:new T,n=e.map(e=>{let t=Array.isArray(e);return e instanceof l.Vector3||e instanceof l.Vector4?[e.x,e.y,e.z]:e instanceof l.Vector2?[e.x,e.y,0]:t&&3===e.length?[e[0],e[1],e[2]]:t&&2===e.length?[e[0],e[1],0]:e});if(r.setPositions(n.flat()),i){t=0xffffff;let e=i.map(e=>e instanceof l.Color?e.toArray():e);r.setColors(e.flat(),S)}return r},[e,d,i,S]);return n.useLayoutEffect(()=>{v.computeLineDistances()},[e,v]),n.useLayoutEffect(()=>{c?y.defines.USE_DASH="":delete y.defines.USE_DASH,y.needsUpdate=!0},[c,y]),n.useEffect(()=>()=>{w.dispose(),y.dispose()},[w]),n.createElement("primitive",(0,s.default)({object:v,ref:h},f),n.createElement("primitive",{object:w,attach:"geometry"}),n.createElement("primitive",(0,s.default)({object:y,attach:"material",color:t,vertexColors:!!i,resolution:[x.width,x.height],linewidth:null!=(m=null!=r?r:o)?m:1,dashed:c,transparent:4===S},f)))}),D=n.forwardRef(({threshold:e=15,geometry:t,...i},r)=>{let o=n.useRef(null);n.useImperativeHandle(r,()=>o.current,[]);let a=n.useMemo(()=>[0,0,0,1,0,0],[]),d=n.useRef(null),c=n.useRef(null);return n.useLayoutEffect(()=>{let i=o.current.parent,r=null!=t?t:null==i?void 0:i.geometry;if(!r||d.current===r&&c.current===e)return;d.current=r,c.current=e;let n=new l.EdgesGeometry(r,e).attributes.position.array;o.current.geometry.setPositions(n),o.current.geometry.attributes.instanceStart.needsUpdate=!0,o.current.geometry.attributes.instanceEnd.needsUpdate=!0,o.current.computeLineDistances()}),n.createElement(G,(0,s.default)({segments:!0,points:a,ref:o,raycast:()=>null},i))});var I=e.i(66894),R=e.i(79098),V=e.i(7180),F=e.i(50948),H=e.i(43879);class W extends n.Component{state={failed:!1};static getDerivedStateFromError(){return{failed:!0}}render(){return this.state.failed?this.props.fallback:this.props.children}}function k({view:e,booth:t}){let i=(0,a.useThree)(e=>e.camera),r=(0,a.useThree)(e=>e.controls);return(0,n.useEffect)(()=>{let n=Math.max(t.width,t.depth,t.height)/1e3,o=Math.min(t.height/1e3/2.8,1);"top"===e?(i.position.set(.001,2.1*n,.001),i.up.set(0,0,-1),r?.target.set(0,0,0)):("front"===e?i.position.set(0,Math.max(1.4,.55*n),2*n):i.position.set(1.2*n,1.05*n,1.45*n),i.up.set(0,1,0),r?.target.set(0,o,0)),i.lookAt(r?.target??new l.Vector3(0,o,0)),i.updateProjectionMatrix(),r?.update()},[t,i,r,e]),null}function N({width:e,depth:t}){let i=(0,n.useMemo)(()=>{let i=[],r=e/2,n=t/2;for(let e=-r;e<=r+1e-4;e+=.5){let t=Math.min(r,e);i.push(t,0,-n,t,0,n)}Math.abs(e/.5-Math.round(e/.5))>1e-4&&i.push(r,0,-n,r,0,n);for(let e=-n;e<=n+1e-4;e+=.5){let t=Math.min(n,e);i.push(-r,0,t,r,0,t)}Math.abs(t/.5-Math.round(t/.5))>1e-4&&i.push(-r,0,n,r,0,n);let o=new l.BufferGeometry;return o.setAttribute("position",new l.Float32BufferAttribute(i,3)),o},[t,e]);return(0,n.useEffect)(()=>()=>i.dispose(),[i]),(0,r.jsx)("lineSegments",{geometry:i,position:[0,.006,0],children:(0,r.jsx)("lineBasicMaterial",{color:"#c7b9a7",transparent:!0,opacity:.72})})}function $({settings:e,color:t,width:i,height:n,baseMap:o,position:a,rotation:s}){let d=(0,H.useMappedTexture)(e.image,e,i/Math.max(n,.001));return(0,r.jsxs)("group",{position:a,rotation:s,children:[(0,r.jsxs)("mesh",{receiveShadow:!0,castShadow:!0,children:[(0,r.jsx)("planeGeometry",{args:[i,n]}),(0,r.jsx)("meshStandardMaterial",{color:t,map:o??void 0,roughness:.86,side:l.DoubleSide})]}),d&&(0,r.jsxs)("mesh",{"position-z":.001,receiveShadow:!0,children:[(0,r.jsx)("planeGeometry",{args:[i,n]}),(0,r.jsx)("meshStandardMaterial",{color:"#ffffff",map:d,roughness:.82,side:l.DoubleSide,transparent:!0,alphaTest:.001,depthWrite:!1,onBeforeCompile:H.clipOutsideTransformedUv,customProgramCacheKey:H.clippedUvProgramKey})]})]})}function q({booth:e}){let t=e.width/1e3,i=e.depth/1e3,o=e.height/1e3,s=function({material:e,repeatX:t,repeatY:i}){let[r,o]=(0,n.useState)(null),s=(0,a.useThree)(e=>e.gl.capabilities.getMaxAnisotropy());return(0,n.useEffect)(()=>{var r;let n=(r=function(e){let t=document.createElement("canvas");t.width=512,t.height=512;let i=t.getContext("2d");if(i.fillStyle="#ffffff",i.fillRect(0,0,t.width,t.height),"dark-carpet"===e||"light-carpet"===e)for(let t=0;t<2600;t+=1){let r=73*t%512,n=151*t%512,o="dark-carpet"===e?110+t%34:90+t%38;i.fillStyle=`rgb(${o} ${o} ${o} / ${"dark-carpet"===e?.11:.08})`,i.fillRect(r,n,1.2,1.2)}else if("concrete"===e)for(let e=0;e<900;e+=1){let t=97*e%512,r=193*e%512,n=110+e%70;i.fillStyle=`rgb(${n} ${n} ${n} / 0.08)`,i.beginPath(),i.arc(t,r,.5+e%3,0,2*Math.PI),i.fill()}else if("gray-tile"===e||"white-tile"===e)i.strokeStyle="gray-tile"===e?"rgb(48 53 52 / 0.32)":"rgb(120 120 114 / 0.25)",i.lineWidth=5,i.strokeRect(2.5,2.5,507,507),i.strokeStyle="rgb(255 255 255 / 0.15)",i.lineWidth=2,i.strokeRect(8,8,496,496);else if("wood"===e){i.strokeStyle="rgb(73 44 24 / 0.35)",i.lineWidth=4,[0,128,256,384,512].forEach(e=>{i.beginPath(),i.moveTo(0,e),i.lineTo(512,e),i.stroke()}),i.strokeStyle="rgb(255 238 211 / 0.14)",i.lineWidth=2;for(let e=0;e<18;e+=1){let t=18+29*e%490;i.beginPath(),i.moveTo(0,t),i.bezierCurveTo(120,t-6,360,t+7,512,t-2),i.stroke()}}let r=new l.CanvasTexture(t);return r.colorSpace=l.SRGBColorSpace,r}(e),r.colorSpace=l.SRGBColorSpace,r.wrapS=l.RepeatWrapping,r.wrapT=l.RepeatWrapping,r.repeat.set(t,i),r.anisotropy=s,r.minFilter=l.LinearMipmapLinearFilter,r.magFilter=l.LinearFilter,r.generateMipmaps=!0,r.needsUpdate=!0,r);return o(n),()=>{n.dispose()}},[s,e,t,i]),r}({material:e.floorMaterial,repeatX:Math.max(1,t),repeatY:Math.max(1,i)});return(0,r.jsxs)("group",{children:[(0,r.jsx)($,{settings:e.floorSurface,color:e.floorColor,width:t,height:i,baseMap:s,position:[0,0,0],rotation:[-Math.PI/2,0,0]}),e.showGrid&&(0,r.jsx)(N,{width:t,depth:i}),"none"!==e.wallMode&&(0,r.jsx)($,{settings:e.wallSurfaces.back,color:e.wallColor,width:t,height:o,position:[0,o/2,-i/2]}),"three"===e.wallMode&&(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)($,{settings:e.wallSurfaces.left,color:e.wallColor,width:i,height:o,position:[-t/2,o/2,0],rotation:[0,Math.PI/2,0]}),(0,r.jsx)($,{settings:e.wallSurfaces.right,color:e.wallColor,width:i,height:o,position:[t/2,o/2,0],rotation:[0,-Math.PI/2,0]})]})]})}function K({fixture:e}){let t=e.width/1e3,i=e.depth/1e3,n=e.height/1e3;return(0,r.jsxs)("mesh",{position:[0,n/2,0],children:[(0,r.jsx)("boxGeometry",{args:[t+.035,n+.035,i+.035]}),(0,r.jsx)("meshBasicMaterial",{color:"#ff6b35",transparent:!0,opacity:.13,depthWrite:!1}),(0,r.jsx)(D,{color:"#ff6b35"})]})}function X({fixture:e}){let t=e.width/1e3,i=e.depth/1e3,n=e.height/1e3,o=(0,r.jsx)("meshStandardMaterial",{color:e.color,roughness:.58,metalness:.03});if("table"===e.category){let e=Math.max(.035,.08*Math.min(t,i));return(0,r.jsxs)("group",{children:[(0,r.jsxs)("mesh",{position:[0,n-.055,0],castShadow:!0,receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,.11,i]}),o]}),[-1,1].flatMap(a=>[-1,1].map(s=>(0,r.jsxs)("mesh",{position:[a*(t/2-e),(n-.11)/2,s*(i/2-e)],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[e,n-.11,e]}),o]},`${a}-${s}`)))]})}if("chair"===e.category||"stool"===e.category){let a="chair"===e.category?Math.min(.55*n,.46):n-Math.max(.06,.12*n),s=Math.max(.025,.075*Math.min(t,i));return(0,r.jsxs)("group",{children:[(0,r.jsxs)("mesh",{position:[0,a,0],castShadow:!0,receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,Math.max(.06,.1*n),i]}),o]}),[-1,1].flatMap(e=>[-1,1].map(n=>(0,r.jsxs)("mesh",{position:[e*(t/2-s),a/2,n*(i/2-s)],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[s,a,s]}),o]},`${e}-${n}`))),"chair"===e.category&&(0,r.jsxs)("mesh",{position:[0,a+(n-a)/2,-i/2+Math.max(.035,.07*i)/2],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,n-a,Math.max(.035,.07*i)]}),o]})]})}if("sofa"===e.category){let e=Math.max(.08,.1*t),a=.42*n;return(0,r.jsxs)("group",{children:[(0,r.jsxs)("mesh",{position:[0,a/2,0],castShadow:!0,receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,a,.82*i]}),o]}),(0,r.jsxs)("mesh",{position:[0,a+(n-a)/2,-i/2+.12*i],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,n-a,.24*i]}),o]}),[-1,1].map(n=>(0,r.jsxs)("mesh",{position:[n*(t/2-e/2),.88*a,0],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[e,.75*a,i]}),o]},n))]})}if("showcase"===e.category){let e=.34*n;return(0,r.jsxs)("group",{children:[(0,r.jsxs)("mesh",{position:[0,e/2,0],castShadow:!0,receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,e,i]}),o]}),(0,r.jsxs)("mesh",{position:[0,e+(n-e)/2,0],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[.96*t,n-e,.96*i]}),(0,r.jsx)("meshPhysicalMaterial",{color:"#dbe9e7",transparent:!0,opacity:.34,roughness:.08,metalness:.05,transmission:.25})]})]})}if("rack"===e.category){let a=Math.max(.025,.055*Math.min(t,i));return(0,r.jsxs)("group",{children:[[-1,1].map(i=>(0,r.jsxs)("mesh",{position:[i*(t/2-a),n/2,0],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[a,n,a]}),(0,r.jsx)("meshStandardMaterial",{color:e.color,metalness:.5,roughness:.32})]},i)),(0,r.jsxs)("mesh",{position:[0,n-a,0],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,a,a]}),(0,r.jsx)("meshStandardMaterial",{color:e.color,metalness:.5,roughness:.32})]}),(0,r.jsxs)("mesh",{position:[0,a/2,0],receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,a,i]}),o]})]})}if("partition"===e.category){let e=Math.min(.08,.08*n);return(0,r.jsxs)("group",{children:[(0,r.jsxs)("mesh",{position:[0,n/2+e/2,0],castShadow:!0,receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,n-e,i]}),o]}),(0,r.jsxs)("mesh",{position:[0,e/2,0],receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[.65*t,e,i]}),(0,r.jsx)("meshStandardMaterial",{color:"#444947",roughness:.68})]})]})}if("plinth"===e.category){let a=Math.min(.024,.08*n);return(0,r.jsxs)("group",{children:[(0,r.jsxs)("mesh",{position:[0,(n-a)/2,0],castShadow:!0,receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,n-a,i]}),o]}),(0,r.jsxs)("mesh",{position:[0,n-a/2,0],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,a,i]}),(0,r.jsx)("meshStandardMaterial",{color:e.color,roughness:.4})]})]})}if("banner"===e.category)return(0,r.jsxs)("group",{children:[(0,r.jsxs)("mesh",{position:[0,n/2+.03,0],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,Math.max(.1,n-.12),Math.min(i,.07)]}),o]}),(0,r.jsxs)("mesh",{position:[0,.035,0],receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[Math.min(t,.45),.07,i]}),(0,r.jsx)("meshStandardMaterial",{color:"#3a3530",roughness:.7})]})]});if("shelf"===e.category||"display"===e.category){let a=Math.max(.035,.045*t),s=Math.max(.028,.025*n),l="shelf"===e.category?4:3;return(0,r.jsxs)("group",{children:[(0,r.jsxs)("mesh",{position:[-t/2+a/2,n/2,0],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[a,n,i]}),o]}),(0,r.jsxs)("mesh",{position:[t/2-a/2,n/2,0],castShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[a,n,i]}),o]}),Array.from({length:l}).map((e,a)=>{let d=s/2+a*(n-s)/(l-1);return(0,r.jsxs)("mesh",{position:[0,d,0],castShadow:!0,receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,s,i]}),o]},a)}),"display"===e.category&&(0,r.jsxs)("mesh",{position:[0,n/2,-i/2+a/2],receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,n,a]}),(0,r.jsx)("meshStandardMaterial",{color:e.color,roughness:.72})]})]})}return(0,r.jsxs)("mesh",{position:[0,n/2,0],castShadow:!0,receiveShadow:!0,children:[(0,r.jsx)("boxGeometry",{args:[t,n,i]}),o]})}function Y({fixture:e}){return(0,r.jsx)(F.MeasuredGlb,{modelUrl:e.modelUrl,width:e.width,depth:e.depth,height:e.height,rotation:e.modelRotation??{x:0,y:0,z:0},materialMode:e.glbMaterialMode??"original",color:e.color})}function J({fixture:e,booth:t,selected:i,snap:o,onSelect:s,onMove:d,onDragging:c}){let f=(0,n.useRef)(!1),h=(0,n.useRef)(null),u=(0,n.useMemo)(()=>new l.Plane(new l.Vector3(0,1,0),0),[]),p=(0,n.useMemo)(()=>new l.Vector3,[]),m=(0,n.useMemo)(()=>new l.Vector3,[]),x=(0,a.useThree)(e=>e.controls);function g(e){let t=e.target;null!==h.current&&t?.releasePointerCapture?.(h.current),f.current=!1,h.current=null,x&&(x.enabled=!0),c(!1)}(0,n.useEffect)(()=>()=>{x&&(x.enabled=!0)},[x]);let v=(0,r.jsx)(X,{fixture:e}),y="photo"===e.source?(0,r.jsx)(V.FixtureBox,{fixture:e}):v;return(0,r.jsxs)("group",{position:[e.x/1e3,.012,e.z/1e3],"rotation-y":e.rotation*Math.PI/180,onPointerDown:function(t){if(t.stopPropagation(),!t.ray.intersectPlane(u,p))return;f.current=!0,h.current=t.pointerId,m.set(e.x/1e3-p.x,0,e.z/1e3-p.z),x&&(x.enabled=!1),c(!0);let i=t.target;i?.setPointerCapture?.(t.pointerId),s(e.id)},onPointerMove:function(i){if(!f.current||(i.stopPropagation(),!i.ray.intersectPlane(u,p)))return;let r=Math.max(10,o)/1e3,n=e.rotation*Math.PI/180,a=(Math.abs(Math.cos(n))*e.width+Math.abs(Math.sin(n))*e.depth)/2e3,s=(Math.abs(Math.sin(n))*e.width+Math.abs(Math.cos(n))*e.depth)/2e3,c=Math.max(0,t.width/2e3-a),h=Math.max(0,t.depth/2e3-s),x=p.x+m.x,g=p.z+m.z,v=l.MathUtils.clamp(Math.round(x/r)*r,-c,c),y=l.MathUtils.clamp(Math.round(g/r)*r,-h,h);d(e.id,Math.round(1e3*v),Math.round(1e3*y))},onPointerUp:g,onPointerCancel:g,onClick:t=>{t.stopPropagation(),s(e.id)},children:[e.modelUrl?(0,r.jsx)(W,{fallback:v,children:(0,r.jsx)(n.Suspense,{fallback:(0,r.jsx)(Q,{fixture:e}),children:(0,r.jsx)(Y,{fixture:e})})}):y,i&&(0,r.jsx)(K,{fixture:e})]})}function Q({fixture:e}){return(0,r.jsxs)("group",{children:[(0,r.jsx)(X,{fixture:{...e,color:"#d9d2c7"}}),(0,r.jsx)(I.Html,{position:[0,e.height/1e3+.2,0],center:!0,children:(0,r.jsx)("div",{className:"model-loading",children:"GLB 불러오는 중…"})})]})}function Z(e){let[t,i]=(0,n.useState)(!1);return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)("color",{attach:"background",args:["#eee9e1"]}),(0,r.jsx)("ambientLight",{intensity:1.35}),(0,r.jsx)("directionalLight",{position:[4,7,5],intensity:2.1,castShadow:!0,"shadow-mapSize":[1024,1024]}),(0,r.jsx)("directionalLight",{position:[-3,4,-2],intensity:.55,color:"#b7ceff"}),(0,r.jsx)(q,{booth:e.booth}),e.fixtures.map(t=>(0,r.jsx)(J,{fixture:t,booth:e.booth,selected:t.id===e.selectedId,snap:e.snap,onSelect:e.onSelect,onMove:e.onMove,onDragging:i},t.id)),(0,r.jsx)(R.OrbitControls,{makeDefault:!0,enabled:!t,enableDamping:!0,dampingFactor:.08,maxPolarAngle:Math.PI/2.01}),(0,r.jsx)(k,{booth:e.booth,view:e.view})]})}e.s(["BoothScene",0,function(e){let t=e.fixtures.find(t=>t.id===e.selectedId),i=e.fixtures.reduce((e,t)=>e+Object.values(t.faceTextures??{}).filter(e=>e?.image).length,0),n=Number(!!e.booth.floorSurface.image)+Object.values(e.booth.wallSurfaces).filter(e=>e.image).length;return(0,r.jsx)("div",{className:"booth-canvas","data-testid":"booth-scene","data-floor-color":e.booth.floorColor,"data-wall-color":e.booth.wallColor,"data-back-surface":e.booth.wallSurfaces.back.image?"image":"color","data-selected-color":t?.color??"","data-selected-material-mode":t?.glbMaterialMode??"","data-selected-transform":t?`${t.width}:${t.depth}:${t.height}:${t.x}:${t.z}:${t.rotation}`:"","data-photo-assets":i,"data-glb-assets":e.fixtures.filter(e=>e.modelUrl).length,"data-surface-assets":n,children:(0,r.jsx)(o.Canvas,{frameloop:"demand",shadows:"basic",camera:{fov:42,near:.01,far:100,position:[4,3.5,5]},dpr:[1,1.75],gl:{antialias:!0,powerPreference:"high-performance"},onPointerMissed:()=>e.onSelect(null),children:(0,r.jsx)(Z,{...e})})})}],36396)},49791,function(e){e.n(e.i(36396))},7180,43879,e=>{"use strict";var t=e.i(56438),i=e.i(70887),r=e.i(97566),n=e.i(92115);function o(e,t,o){let[a,s]=(0,r.useState)(null),l=(0,n.useThree)(e=>Math.min(8,e.gl.capabilities.getMaxAnisotropy())),d=(0,n.useThree)(e=>e.invalidate);return(0,r.useEffect)(()=>{let t=!0;if(s(null),e)return new i.TextureLoader().load(e,e=>{if(!t)return void e.dispose();let r=e.image,n=r.naturalWidth??r.width??1,o=r.naturalHeight??r.height??1;e.colorSpace=i.SRGBColorSpace,e.wrapS=i.ClampToEdgeWrapping,e.wrapT=i.ClampToEdgeWrapping,e.anisotropy=l,e.minFilter=i.LinearMipmapLinearFilter,e.magFilter=i.LinearFilter,e.matrixAutoUpdate=!1,s({texture:e,imageAspect:n/Math.max(o,1)}),d()},void 0,()=>t&&s(null)),()=>{t=!1}},[l,e,d]),(0,r.useEffect)(()=>()=>a?.texture.dispose(),[a]),(0,r.useEffect)(()=>{var e;let i,r,n,s,l,c,f;if(!a||!t)return;let h=(e=a.imageAspect,n=(i=Math.max(o,1e-4))/(r=Math.max(e,1e-4)),s=r/i,l="cover"===t.fit?Math.min(1,n):Math.max(1,n),c="cover"===t.fit?Math.min(1,s):Math.max(1,s),{repeatX:l/(f=Math.max(t.zoom,.01)),repeatY:c/f,offsetX:-(.5*(t.x/100)),offsetY:-(.5*(t.y/100)),rotation:t.rotation*Math.PI/180});a.texture.matrix.setUvTransform(h.offsetX,h.offsetY,h.repeatX,h.repeatY,h.rotation,.5,.5),a.texture.needsUpdate=!0,d()},[d,a,t,t?.fit,t?.rotation,t?.x,t?.y,t?.zoom,o]),a?.texture??null}function a(e){e.fragmentShader=e.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
    if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) {
      diffuseColor.a = 0.0;
    }`)}function s(){return"pawplan-clipped-transformed-uv-v1"}function l({face:e,settings:r,width:n,height:d,position:c,rotation:f}){let h=o(r?.image,r,n/Math.max(d,1));return h?(0,t.jsxs)("mesh",{name:`photo-face-${e}`,position:c,rotation:f,castShadow:!0,receiveShadow:!0,children:[(0,t.jsx)("planeGeometry",{args:[n/1e3,d/1e3]}),(0,t.jsx)("meshStandardMaterial",{map:h,color:"#ffffff",roughness:.72,side:i.DoubleSide,transparent:!0,alphaTest:.001,depthWrite:!1,onBeforeCompile:a,customProgramCacheKey:s,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1})]}):null}e.s(["clipOutsideTransformedUv",0,a,"clippedUvProgramKey",0,s,"useMappedTexture",0,o],43879),e.s(["FixtureBox",0,function({fixture:e}){let i=e.width/1e3,r=e.depth/1e3,n=e.height/1e3;return(0,t.jsxs)("group",{children:[(0,t.jsxs)("mesh",{position:[0,n/2,0],castShadow:!0,receiveShadow:!0,children:[(0,t.jsx)("boxGeometry",{args:[i,n,r]}),(0,t.jsx)("meshStandardMaterial",{color:e.color,roughness:.68})]}),(0,t.jsx)(l,{face:"front",settings:e.faceTextures?.front,width:e.width,height:e.height,position:[0,n/2,r/2+5e-4]}),(0,t.jsx)(l,{face:"back",settings:e.faceTextures?.back,width:e.width,height:e.height,position:[0,n/2,-r/2-5e-4],rotation:[0,Math.PI,0]}),(0,t.jsx)(l,{face:"left",settings:e.faceTextures?.left,width:e.depth,height:e.height,position:[-i/2-5e-4,n/2,0],rotation:[0,-Math.PI/2,0]}),(0,t.jsx)(l,{face:"right",settings:e.faceTextures?.right,width:e.depth,height:e.height,position:[i/2+5e-4,n/2,0],rotation:[0,Math.PI/2,0]})]})}],7180)}]);
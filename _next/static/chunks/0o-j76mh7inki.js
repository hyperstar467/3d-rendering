(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,7180,43879,e=>{"use strict";var t=e.i(56438),r=e.i(70887),a=e.i(97566),i=e.i(92115);function o(e,t,o){let[s,n]=(0,a.useState)(null),v=(0,i.useThree)(e=>Math.min(8,e.gl.capabilities.getMaxAnisotropy())),u=(0,i.useThree)(e=>e.invalidate);return(0,a.useEffect)(()=>{let t=!0;if(n(null),e)return new r.TextureLoader().load(e,e=>{if(!t)return void e.dispose();let a=e.image,i=a.naturalWidth??a.width??1,o=a.naturalHeight??a.height??1;e.colorSpace=r.SRGBColorSpace,e.wrapS=r.ClampToEdgeWrapping,e.wrapT=r.ClampToEdgeWrapping,e.anisotropy=v,e.minFilter=r.LinearMipmapLinearFilter,e.magFilter=r.LinearFilter,e.matrixAutoUpdate=!1,n({texture:e,imageAspect:i/Math.max(o,1)}),u()},void 0,()=>t&&n(null)),()=>{t=!1}},[v,e,u]),(0,a.useEffect)(()=>()=>s?.texture.dispose(),[s]),(0,a.useEffect)(()=>{var e;let r,a,i,n,v,f,l;if(!s||!t)return;let c=(e=s.imageAspect,i=(r=Math.max(o,1e-4))/(a=Math.max(e,1e-4)),n=a/r,v="cover"===t.fit?Math.min(1,i):Math.max(1,i),f="cover"===t.fit?Math.min(1,n):Math.max(1,n),{repeatX:v/(l=Math.max(t.zoom,.01)),repeatY:f/l,offsetX:-(.5*(t.x/100)),offsetY:-(.5*(t.y/100)),rotation:t.rotation*Math.PI/180});s.texture.matrix.setUvTransform(c.offsetX,c.offsetY,c.repeatX,c.repeatY,c.rotation,.5,.5),s.texture.needsUpdate=!0,u()},[u,s,t,t?.fit,t?.rotation,t?.x,t?.y,t?.zoom,o]),s?.texture??null}function s(e){e.fragmentShader=e.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
    if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) {
      diffuseColor.a = 0.0;
    }`)}function n(){return"pawplan-clipped-transformed-uv-v1"}function v({face:e,settings:a,width:i,height:u,position:f,rotation:l}){let c=o(a?.image,a,i/Math.max(u,1));return c?(0,t.jsxs)("mesh",{name:`photo-face-${e}`,position:f,rotation:l,castShadow:!0,receiveShadow:!0,children:[(0,t.jsx)("planeGeometry",{args:[i/1e3,u/1e3]}),(0,t.jsx)("meshStandardMaterial",{map:c,color:"#ffffff",roughness:.72,side:r.DoubleSide,transparent:!0,alphaTest:.001,depthWrite:!1,onBeforeCompile:s,customProgramCacheKey:n,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1})]}):null}e.s(["clipOutsideTransformedUv",0,s,"clippedUvProgramKey",0,n,"useMappedTexture",0,o],43879),e.s(["FixtureBox",0,function({fixture:e}){let r=e.width/1e3,a=e.depth/1e3,i=e.height/1e3;return(0,t.jsxs)("group",{children:[(0,t.jsxs)("mesh",{position:[0,i/2,0],castShadow:!0,receiveShadow:!0,children:[(0,t.jsx)("boxGeometry",{args:[r,i,a]}),(0,t.jsx)("meshStandardMaterial",{color:e.color,roughness:.68})]}),(0,t.jsx)(v,{face:"front",settings:e.faceTextures?.front,width:e.width,height:e.height,position:[0,i/2,a/2+5e-4]}),(0,t.jsx)(v,{face:"back",settings:e.faceTextures?.back,width:e.width,height:e.height,position:[0,i/2,-a/2-5e-4],rotation:[0,Math.PI,0]}),(0,t.jsx)(v,{face:"left",settings:e.faceTextures?.left,width:e.depth,height:e.height,position:[-r/2-5e-4,i/2,0],rotation:[0,-Math.PI/2,0]}),(0,t.jsx)(v,{face:"right",settings:e.faceTextures?.right,width:e.depth,height:e.height,position:[r/2+5e-4,i/2,0],rotation:[0,Math.PI/2,0]})]})}],7180)},36731,e=>{"use strict";var t=e.i(56438),r=e.i(20756),a=e.i(77964),i=e.i(79098),o=e.i(7180);e.s(["PhotoFixtureReview",0,function({fixture:e}){let s=Math.max(e.width,e.depth,e.height)/1e3,n=e.faceTextures?.front;return(0,t.jsxs)("div",{className:"model-review-canvas photo-review-canvas","data-testid":"photo-fixture-preview","data-front-transform":n?`${n.fit}:${n.zoom}:${n.x}:${n.y}:${n.rotation}`:"none","data-color":e.color,children:[(0,t.jsxs)(r.Canvas,{frameloop:"demand",shadows:"basic",camera:{position:[1.7*s,1.25*s,1.9*s],fov:38,near:.01,far:100},dpr:[1,1.5],children:[(0,t.jsx)("color",{attach:"background",args:["#eee9e1"]}),(0,t.jsx)("ambientLight",{intensity:1.5}),(0,t.jsx)("directionalLight",{position:[3,5,4],intensity:2.1,castShadow:!0}),(0,t.jsx)(o.FixtureBox,{fixture:e}),(0,t.jsx)(a.ContactShadows,{frames:1,resolution:256,position:[0,.002,0],opacity:.2,scale:Math.max(3,3*s),blur:2,far:2*s}),(0,t.jsx)(i.OrbitControls,{makeDefault:!0,enableDamping:!0,minDistance:Math.max(.5,.7*s),maxDistance:Math.max(5,8*s),target:[0,e.height/2e3,0]})]}),(0,t.jsx)("div",{className:"review-orbit-hint",children:"별도 3D 검수 · 드래그 회전 · 휠 확대"})]})}])},92933,function(e){e.n(e.i(36731))},77964,e=>{"use strict";var t=e.i(6399),r=e.i(97566),a=e.i(70887),i=e.i(92115),o=e.i(52011);let s={uniforms:{tDiffuse:{value:null},h:{value:1/512}},vertexShader:`
      varying vec2 vUv;

      void main() {

        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

      }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float h;

    varying vec2 vUv;

    void main() {

    	vec4 sum = vec4( 0.0 );

    	sum += texture2D( tDiffuse, vec2( vUv.x - 4.0 * h, vUv.y ) ) * 0.051;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 3.0 * h, vUv.y ) ) * 0.0918;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 2.0 * h, vUv.y ) ) * 0.12245;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 1.0 * h, vUv.y ) ) * 0.1531;
    	sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 1.0 * h, vUv.y ) ) * 0.1531;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 2.0 * h, vUv.y ) ) * 0.12245;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 3.0 * h, vUv.y ) ) * 0.0918;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 4.0 * h, vUv.y ) ) * 0.051;

    	gl_FragColor = sum;

    }
  `},n={uniforms:{tDiffuse:{value:null},v:{value:1/512}},vertexShader:`
    varying vec2 vUv;

    void main() {

      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    }
  `,fragmentShader:`

  uniform sampler2D tDiffuse;
  uniform float v;

  varying vec2 vUv;

  void main() {

    vec4 sum = vec4( 0.0 );

    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 4.0 * v ) ) * 0.051;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 3.0 * v ) ) * 0.0918;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 2.0 * v ) ) * 0.12245;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 1.0 * v ) ) * 0.1531;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 1.0 * v ) ) * 0.1531;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 2.0 * v ) ) * 0.12245;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 3.0 * v ) ) * 0.0918;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 4.0 * v ) ) * 0.051;

    gl_FragColor = sum;

  }
  `},v=r.forwardRef(({scale:e=10,frames:v=1/0,opacity:u=1,width:f=1,height:l=1,blur:c=1,near:h=0,far:m=10,resolution:d=512,smooth:x=!0,color:p="#000000",depthWrite:g=!1,renderOrder:U,...D},y)=>{let M,w,T=r.useRef(null),S=(0,i.useThree)(e=>e.scene),b=(0,i.useThree)(e=>e.gl),j=r.useRef(null);f*=Array.isArray(e)?e[0]:e||1,l*=Array.isArray(e)?e[1]:e||1;let[C,P,R,F,A,E,B]=r.useMemo(()=>{let e=new a.WebGLRenderTarget(d,d),t=new a.WebGLRenderTarget(d,d);t.texture.generateMipmaps=e.texture.generateMipmaps=!1;let r=new a.PlaneGeometry(f,l).rotateX(Math.PI/2),i=new a.Mesh(r),o=new a.MeshDepthMaterial;o.depthTest=o.depthWrite=!1,o.onBeforeCompile=e=>{e.uniforms={...e.uniforms,ucolor:{value:new a.Color(p)}},e.fragmentShader=e.fragmentShader.replace("void main() {",`uniform vec3 ucolor;
           void main() {
          `),e.fragmentShader=e.fragmentShader.replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );","vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );")};let v=new a.ShaderMaterial(s),u=new a.ShaderMaterial(n);return u.depthTest=v.depthTest=!1,[e,r,o,i,v,u,t]},[d,f,l,e,p]),I=e=>{F.visible=!0,F.material=A,A.uniforms.tDiffuse.value=C.texture,A.uniforms.h.value=e/256,b.setRenderTarget(B),b.render(F,j.current),F.material=E,E.uniforms.tDiffuse.value=B.texture,E.uniforms.v.value=e/256,b.setRenderTarget(C),b.render(F,j.current),F.visible=!1},L=0;return(0,o.useFrame)(()=>{j.current&&(v===1/0||L<v)&&(L++,M=S.background,w=S.overrideMaterial,T.current.visible=!1,S.background=null,S.overrideMaterial=R,b.setRenderTarget(C),b.render(S,j.current),I(c),x&&I(.4*c),b.setRenderTarget(null),T.current.visible=!0,S.overrideMaterial=w,S.background=M)}),r.useImperativeHandle(y,()=>T.current,[]),r.createElement("group",(0,t.default)({"rotation-x":Math.PI/2},D,{ref:T}),r.createElement("mesh",{renderOrder:U,geometry:P,scale:[1,-1,1],rotation:[-Math.PI/2,0,0]},r.createElement("meshBasicMaterial",{transparent:!0,map:C.texture,opacity:u,depthWrite:g})),r.createElement("orthographicCamera",{ref:j,args:[-f/2,f/2,l/2,-l/2,h,m]}))});e.s(["ContactShadows",0,v],77964)}]);
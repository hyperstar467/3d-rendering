(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,15249,e=>{"use strict";var t=e.i(56438),r=e.i(97566),a=e.i(20756),i=e.i(77964),v=e.i(66894),s=e.i(79098),n=e.i(50948);class u extends r.Component{state={failed:!1};static getDerivedStateFromError(){return{failed:!0}}render(){return this.state.failed?this.props.fallback:this.props.children}}e.s(["ModelReview",0,function(e){let[o,l]=(0,r.useState)(null),c=Math.max(e.width,e.depth,e.height)/1e3;return(0,t.jsxs)("div",{className:"model-review-canvas","data-testid":"glb-preview","data-material-mode":e.materialMode??"original","data-color":e.color??"",children:[(0,t.jsxs)(a.Canvas,{frameloop:"demand",shadows:"basic",camera:{position:[1.7*c,1.25*c,1.9*c],fov:38,near:.01,far:100},dpr:[1,1.5],children:[(0,t.jsx)("color",{attach:"background",args:["#eee9e1"]}),(0,t.jsx)("ambientLight",{intensity:1.4}),(0,t.jsx)("directionalLight",{position:[3,5,4],intensity:2.2,castShadow:!0}),(0,t.jsx)(u,{fallback:(0,t.jsx)(v.Html,{center:!0,children:(0,t.jsx)("div",{className:"model-loading model-error",children:"GLB 경계 크기를 측정할 수 없습니다."})}),children:(0,t.jsx)(r.Suspense,{fallback:(0,t.jsx)(v.Html,{center:!0,children:(0,t.jsx)("div",{className:"model-loading",children:"3D 모델을 준비하는 중…"})}),children:(0,t.jsx)(n.MeasuredGlb,{...e,onMeasured:l})})},e.modelUrl),(0,t.jsx)(i.ContactShadows,{frames:1,resolution:256,position:[0,.002,0],opacity:.2,scale:Math.max(3,3*c),blur:2,far:2*c}),(0,t.jsx)(s.OrbitControls,{makeDefault:!0,enableDamping:!0,minDistance:Math.max(.5,.7*c),maxDistance:Math.max(5,8*c),target:[0,e.height/2e3,0]})]}),(0,t.jsx)("div",{className:`measurement-badge ${o?.matches?"matches":""}`,children:o?`${Math.round(o.width)} \xd7 ${Math.round(o.depth)} \xd7 ${Math.round(o.height)} mm \xb7 ${o.matches?"실측 일치":"불일치"}`:"BoundingBox 측정 중…"}),(0,t.jsx)("div",{className:"review-orbit-hint",children:"Orientation → Scale 분리 검수 · 드래그 회전"})]})}])},30737,function(e){e.n(e.i(15249))},77964,e=>{"use strict";var t=e.i(6399),r=e.i(97566),a=e.i(70887),i=e.i(92115),v=e.i(52011);let s={uniforms:{tDiffuse:{value:null},h:{value:1/512}},vertexShader:`
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
  `},u=r.forwardRef(({scale:e=10,frames:u=1/0,opacity:o=1,width:l=1,height:c=1,blur:m=1,near:d=0,far:f=10,resolution:h=512,smooth:x=!0,color:g="#000000",depthWrite:D=!1,renderOrder:p,...U},y)=>{let M,b,w=r.useRef(null),j=(0,i.useThree)(e=>e.scene),S=(0,i.useThree)(e=>e.gl),C=r.useRef(null);l*=Array.isArray(e)?e[0]:e||1,c*=Array.isArray(e)?e[1]:e||1;let[T,R,k,P,B,A,E]=r.useMemo(()=>{let e=new a.WebGLRenderTarget(h,h),t=new a.WebGLRenderTarget(h,h);t.texture.generateMipmaps=e.texture.generateMipmaps=!1;let r=new a.PlaneGeometry(l,c).rotateX(Math.PI/2),i=new a.Mesh(r),v=new a.MeshDepthMaterial;v.depthTest=v.depthWrite=!1,v.onBeforeCompile=e=>{e.uniforms={...e.uniforms,ucolor:{value:new a.Color(g)}},e.fragmentShader=e.fragmentShader.replace("void main() {",`uniform vec3 ucolor;
           void main() {
          `),e.fragmentShader=e.fragmentShader.replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );","vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );")};let u=new a.ShaderMaterial(s),o=new a.ShaderMaterial(n);return o.depthTest=u.depthTest=!1,[e,r,v,i,u,o,t]},[h,l,c,e,g]),G=e=>{P.visible=!0,P.material=B,B.uniforms.tDiffuse.value=T.texture,B.uniforms.h.value=e/256,S.setRenderTarget(E),S.render(P,C.current),P.material=A,A.uniforms.tDiffuse.value=E.texture,A.uniforms.v.value=e/256,S.setRenderTarget(T),S.render(P,C.current),P.visible=!1},L=0;return(0,v.useFrame)(()=>{C.current&&(u===1/0||L<u)&&(L++,M=j.background,b=j.overrideMaterial,w.current.visible=!1,j.background=null,j.overrideMaterial=k,S.setRenderTarget(T),S.render(j,C.current),G(m),x&&G(.4*m),S.setRenderTarget(null),w.current.visible=!0,j.overrideMaterial=b,j.background=M)}),r.useImperativeHandle(y,()=>w.current,[]),r.createElement("group",(0,t.default)({"rotation-x":Math.PI/2},U,{ref:w}),r.createElement("mesh",{renderOrder:p,geometry:R,scale:[1,-1,1],rotation:[-Math.PI/2,0,0]},r.createElement("meshBasicMaterial",{transparent:!0,map:T.texture,opacity:o,depthWrite:D})),r.createElement("orthographicCamera",{ref:C,args:[-l/2,l/2,c/2,-c/2,d,f]}))});e.s(["ContactShadows",0,u],77964)}]);
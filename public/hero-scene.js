import * as THREE from 'three';

const canvas=document.querySelector('#evms-3d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
if(canvas){
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,.1,8.2);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;
 const rig=new THREE.Group();scene.add(rig);
 const bodyMat=new THREE.MeshPhysicalMaterial({color:0x252a37,metalness:.78,roughness:.28,clearcoat:1});
 const edgeMat=new THREE.MeshPhysicalMaterial({color:0x6950c9,metalness:.65,roughness:.2,emissive:0x160b3a,emissiveIntensity:.9});
 const glassMat=new THREE.MeshPhysicalMaterial({color:0x251052,metalness:.25,roughness:.08,transmission:.3,transparent:true,opacity:.92,emissive:0x20086c,emissiveIntensity:1.8});
 const housing=new THREE.Mesh(new THREE.BoxGeometry(4,2.15,2.3,4,4,4),bodyMat);rig.add(housing);
 const housingEdges=new THREE.LineSegments(new THREE.EdgesGeometry(housing.geometry),new THREE.LineBasicMaterial({color:0x6e5a9b,transparent:true,opacity:.45}));housing.add(housingEdges);
 const hood=new THREE.Mesh(new THREE.BoxGeometry(4.45,.2,2.65),edgeMat);hood.position.set(0,1.13,-.05);hood.rotation.z=-.02;rig.add(hood);
 const front=new THREE.Group();front.position.set(0,0,1.15);rig.add(front);
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.88,.98,.72,64),bodyMat);barrel.rotation.x=Math.PI/2;barrel.position.z=.35;front.add(barrel);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.78,.12,20,80),edgeMat);rim.position.z=.75;front.add(rim);
 const lens=new THREE.Mesh(new THREE.CircleGeometry(.7,64),glassMat);lens.position.z=.78;front.add(lens);
 const iris=new THREE.Mesh(new THREE.TorusGeometry(.33,.028,12,64),new THREE.MeshBasicMaterial({color:0x86b9ff}));iris.position.z=.79;front.add(iris);
 const core=new THREE.Mesh(new THREE.CircleGeometry(.12,40),new THREE.MeshBasicMaterial({color:0xe4eaff}));core.position.z=.8;front.add(core);
 const mount=new THREE.Mesh(new THREE.CylinderGeometry(.28,.35,1.3,24),bodyMat);mount.position.set(-1.18,-1.65,.15);mount.rotation.z=.18;rig.add(mount);
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.82,.82,.18,40),edgeMat);base.position.set(-1.33,-2.24,.15);rig.add(base);
 const beam=new THREE.Mesh(new THREE.ConeGeometry(2.4,5.2,48,1,true),new THREE.MeshBasicMaterial({color:0x7d5bff,transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false}));beam.rotation.x=-Math.PI/2;beam.position.set(0,0,4.4);rig.add(beam);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(3.25,.015,8,128),new THREE.MeshBasicMaterial({color:0x6950cc,transparent:true,opacity:.55}));ring.rotation.x=1.23;ring.rotation.y=.5;scene.add(ring);
 const dots=new THREE.BufferGeometry(),positions=[];for(let i=0;i<170;i++){const a=Math.random()*Math.PI*2,r=3.2+Math.random()*2.9;positions.push(Math.cos(a)*r,(Math.random()-.5)*5,Math.sin(a)*r-1)}dots.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const particles=new THREE.Points(dots,new THREE.PointsMaterial({color:0x9b83e7,size:.025,transparent:true,opacity:.7}));scene.add(particles);
 scene.add(new THREE.HemisphereLight(0xbca9ff,0x08090e,2.2));
 const key=new THREE.DirectionalLight(0xffffff,5);key.position.set(3,4,6);scene.add(key);
 const violet=new THREE.PointLight(0x7653ff,60,12);violet.position.set(-3,-1,5);scene.add(violet);
 let pointerX=0,pointerY=0;
 const resize=()=>{const box=canvas.getBoundingClientRect();renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix()};
 canvas.addEventListener('pointermove',e=>{const box=canvas.getBoundingClientRect();pointerX=(e.clientX-box.left)/box.width-.5;pointerY=(e.clientY-box.top)/box.height-.5});
 canvas.addEventListener('pointerleave',()=>{pointerX=pointerY=0});addEventListener('resize',resize);resize();
 const clock=new THREE.Clock();
 const draw=()=>{const t=clock.getElapsedTime(),targetY=.34+pointerX*.3;rig.rotation.y+=(targetY-rig.rotation.y)*.035;rig.rotation.x+=(-.07-pointerY*.14-rig.rotation.x)*.035;rig.position.y=Math.sin(t*.65)*.08;ring.rotation.z=t*.06;particles.rotation.y=t*.012;renderer.render(scene,camera);if(!reduced.matches)requestAnimationFrame(draw)};
 draw();reduced.addEventListener('change',()=>{if(!reduced.matches)draw()});
}

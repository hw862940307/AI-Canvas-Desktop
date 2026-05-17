import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, useEdges, useNodes, NodeResizer, useReactFlow } from '@xyflow/react';
import { 
  Camera, 
  RotateCcw, 
  Focus, 
  Maximize2, 
  X, 
  Settings2, 
  ChevronDown, 
  Info, 
  Copy, 
  Check, 
  Box, 
  User, 
  Layers, 
  Move3d,
  ZoomIn,
  ZoomOut,
  Aperture as ApertureIcon,
  Image as ImageIcon
} from 'lucide-react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Grid, Html, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';

// --- Data Tables ---

export const HORIZONTAL_DATA = [
  { range: [0, 10], name: '正前中心视角', desc: '相机位于参考图主体正前方，镜头光轴垂直对准主体正面中心线。目标画面呈正前方观察关系，主体正面方向约95-100%可见，左右侧向空间几乎不可见，整体保持居中对称。' },
  { range: [10, 20], name: '极微左前偏移视角', desc: '相机从正前方轻微移动到参考图主体左前方约15°。目标画面仍以正面为主要观察面，仅显露极弱左侧空间厚度，用轻微侧向透视打破完全平面感。' },
  { range: [20, 30], name: '轻微左前视角', desc: '相机位于参考图主体左前方约25°。目标画面中主体正面方向仍主要可读，左侧空间关系开始自然显露，形成轻微左前观察关系。' },
  { range: [30, 40], name: '浅左前三分视角', desc: '相机位于参考图主体左前方约35°。目标画面形成浅左前三分视角，正面方向与左侧空间关系同时可见，左侧轮廓和空间深度开始增强。' },
  { range: [40, 50], name: '标准左前三分之四视角', desc: '相机位于参考图主体左前方约45°。目标画面形成标准左前三分之四空间观察关系，主体正面方向仍主要可读，左侧空间关系自然显露，背面方向不可作为主视面。' },
  { range: [50, 60], name: '深左前三分之四视角', desc: '相机继续向参考图主体左侧移动至约55°。目标画面中左侧空间关系更明显，正面方向开始压缩但仍应保持基本可读。' },
  { range: [60, 70], name: '左侧主导前视角', desc: '相机位于参考图主体左侧偏前约65°。目标画面以左侧轮廓和侧向深度为主要观察内容，正面方向仅保留部分可读性。' },
  { range: [70, 80], name: '近左侧前缘视角', desc: '相机接近参考图主体正左侧，但仍保留少量正面边缘。目标画面适合描述左侧轮廓、横向空间层级和轻微正面边缘关系。' },
  { range: [80, 90], name: '近纯左侧视角', desc: '相机几乎位于参考图主体正左侧。目标画面以左侧空间方向为主，正面方向只允许极窄边缘或几乎不可见。' },
  { range: [90, 100], name: '纯左侧轮廓视角', desc: '相机位于参考图主体正左侧约90°。目标画面形成正左侧观察关系，强调左侧轮廓、侧向深度和横向空间层级，正面不再作为主要观察面。' },
  { range: [100, 110], name: '极微左后偏移视角', desc: '相机从正左侧略微移动到参考图主体左后方。目标画面仍以左侧空间为主，同时开始显露背向空间边缘，正面方向不可作为主视面。' },
  { range: [110, 120], name: '浅左后视角', desc: '相机位于参考图主体左后方约115°。目标画面同时呈现左侧空间和背向空间，正面方向应完全退出主视关系。' },
  { range: [120, 130], name: '标准左后过渡视角', desc: '相机位于参考图主体左后方约125°。目标画面强调背向空间与左侧轮廓之间的过渡关系，形成左后方三维空间观察。' },
  { range: [130, 140], name: '深左后三分之四视角', desc: '相机位于参考图主体 left_back 135 左右。目标画面形成左后三分之四观察关系，背向方向与左侧空间比例较均衡，正面方向不可作为主视面。' },
  { range: [140, 150], name: '背面主导左后视角', desc: '相机接近参考图主体背面但仍偏左。目标画面以背向空间为主，左侧空间只作为边缘轮廓和深度补充。' },
  { range: [150, 160], name: '偏左背面斜视角', desc: '相机位于参考图主体背面偏左方向。目标画面大面积呈现背向关系，左侧空间收缩为窄边，正面不可见。' },
  { range: [160, 170], name: '近正后左偏视角', desc: '相机接近参考图主体正后方并略偏左。目标画面以背向空间为主，左侧只保留极窄边缘关系。' },
  { range: [170, 180], name: '极微左偏后视角', desc: '相机几乎位于参考图主体正后方，仅有极轻微左侧偏移。目标画面背向方向几乎完整可见。' },
  { range: [180, 190], name: '正后中心视角', desc: '相机位于参考图主体正后方约180°，镜头光轴垂直对准主体背向中心线。目标画面以背面方向作为主要空间方位，正面方向不可作为主视面。' },
  { range: [190, 200], name: '极微右偏后视角', desc: '相机从正后方轻微移动到参考图主体右后方。目标画面仍以背向空间为主，右侧边缘开始显露。' },
  { range: [200, 210], name: '近正右后视角', desc: '相机位于参考图主体右后方浅角位置。背面结构仍为主，右侧厚度轻微显露，正面不可见。' },
  { range: [210, 220], name: '偏右后斜视角', desc: '相机位于参考图主体右后方约215°。目标画面同时呈现背向和右侧空间。' },
  { range: [220, 230], name: '标准右后过渡视角', desc: '背面与右侧共同构成后方视角，消失点向右移动，正面不可见。' },
  { range: [230, 240], name: '深右后三分之四视角', desc: '相机位于右前方约235°。' },
  { range: [240, 250], name: '右侧主导后视角', desc: '相机位于右侧偏后约245°。' },
  { range: [250, 260], name: '浅右后侧视角', desc: '接近右侧面但仍偏后。' },
  { range: [260, 270], name: '近纯右侧视角', desc: '相机几乎位于参考图主体正右侧。' },
  { range: [270, 280], name: '纯右侧轮廓视角', desc: '相机位于参考图主体正右侧约270°。' },
  { range: [280, 290], name: '近右侧前缘视角', desc: '相机从右侧向前移动。' },
  { range: [290, 300], name: '右侧主导前视角', desc: '相机位于参考图主体右侧偏前约295°。目标画面中右侧空间为主，正面方向部分可读，形成右侧主导前视关系。' },
  { range: [300, 310], name: '深右前三分之四视角', desc: '相机位于参考图主体右前方约305°。目标画面同时呈现右侧空间和正面方向，右侧空间关系更强，正面信息逐渐展开。' },
  { range: [310, 320], name: '标准右前三分之四视角', desc: '相机位于参考图主体右前方约315°。目标画面形成标准右前三分之四空间观察关系，主体正面方向仍主要可读，右侧空间关系自然显露。' },
  { range: [320, 330], name: '浅右前三分视角', desc: '相机位于参考图主体右前方约325°。目标画面以正面方向为主，右侧空间作为立体深度补充。' },
  { range: [330, 340], name: '轻微右前视角', desc: '相机位于参考图主体正前方偏右约335°。目标画面正面方向约80-85%可见，右侧空间保留轻微边缘关系。' },
  { range: [340, 350], name: '极微右前偏移视角', desc: '相机几乎回到参考图主体正前方，仅通过右侧极窄空间边缘表达立体关系，正面方向完整可读。' },
  { range: [350, 360], name: '准正前回归视角', desc: '相机接近参考图主体正前方，右侧仅剩极弱空间边缘。360°可视为回到0°正前方。' },
];

export const CURRENT_VIEWPOINT_DATA = [
  { id: 'front_view', name: '正前方平视', desc: '当前参考图呈现正前方平视视角，参考图主体正面方向为主要观察面，左右空间关系相对对称。', short: '正前方' },
  { id: 'left_front_45', name: '左前45°', desc: '当前参考图呈现左前三分之四视角，参考图主体正面方向仍主要可读，左侧空间关系自然显露。', short: '左前45°' },
  { id: 'right_front_45', name: '右前45°', desc: '当前参考图呈现右前三分之四视角，参考图主体正面方向仍主要可读，右侧空间关系自然显露。', short: '右前45°' },
  { id: 'left_side', name: '正左侧', desc: '当前参考图呈现正左侧视角，左侧轮廓和横向空间关系为主要观察内容。', short: '正左侧' },
  { id: 'right_side', name: '正右侧', desc: '当前参考图呈现正右侧视角，右侧轮廓和横向空间关系为主要观察内容。', short: '正右侧' },
  { id: 'rear_view', name: '正后方', desc: '当前参考图呈现背向视角，背面方向为主要观察面，正面方向不可作为主视面。', short: '正后方' },
  { id: 'top_view', name: '顶视', desc: '当前参考图呈现顶视关系，相机位于主体上方，顶部方向或平面关系为主要视觉内容层次。', short: '顶视' },
  { id: 'low_angle_front', name: '正前低机位', desc: '当前参考图呈现正前方低机位视角，主体正面可见，下方空间或高度感更明显。', short: '前低机位' },
  { id: 'auto', name: '自动识别', desc: '当前参考图视角由上游视觉分析或节点内部逻辑自动识别。', short: '自动视角' },
];

export const FOCUS_POINT_DATA = [
  { id: 'center', name: '主体中心', desc: '焦点对准主体的几何中心。' },
  { id: 'canvas_center', name: '画面中心', desc: '焦点保持在画面构图的绝对中心。' },
  { id: 'front', name: '主体前部', desc: '焦点对准主体的前沿结构。' },
  { id: 'left', name: '主体左侧', desc: '焦点对准主体的左侧轮廓。' },
  { id: 'right', name: '主体右侧', desc: '焦点对准主体的右侧轮廓。' },
  { id: 'top', name: '主体顶部', desc: '焦点对准主体的顶部平面。' },
];

export const NEGATIVE_SPATIAL_CONSTRAINTS = [
  '禁止产生主体身份漂移',
  '主体结构重塑',
  '主体比例失调',
  '构图中心偏移',
  '错误可见面',
  '错误遮挡边缘',
  '错误前后层级',
  '左右翻转',
  '前后混淆',
  '透视角度不合理',
  '消失点定位错误',
  '背景过度扭曲',
  '主体边缘锯齿或异常重合',
  '参考图中没有的部件或细节',
  '参考图中原有核心细节的缺失或错误变形'
];

const VERTICAL_DATA = [
  { angle: -90, name: '绝对顶心俯视', desc: '相机位于主体正上方，垂直向下俯拍，只显示顶部平面结构，侧面几乎不可见。' },
  { angle: -45, name: '标准高位俯拍', desc: '相机位于主体斜上方约45°，同时展示顶部、正面和侧面关系，是标准高位三维展示角度。' },
  { angle: -30, name: '标准三十度俯拍', desc: '相机略高于主体，以约30°向下俯拍，顶部与正面关系均衡。' },
  { angle: 0, name: '标准平视', desc: '相机与主体中心处于同一水平高度，镜头光轴水平对齐，不强调顶部或底部。' },
  { angle: 30, name: '标准仰拍视角', desc: '相机略低于主体，以约30°向上仰拍，底部轮廓更宽，主体更有英雄感。' },
  { angle: 45, name: '标准低位仰拍', desc: '45°黄金仰拍位，底部与侧面形成稳定三角构图。' },
  { angle: 90, name: '绝对底心视角', desc: '相机位于主体正下方，垂直向上拍摄，只允许显示底部平面或下方结构。' },
];

const DISTANCE_DATA = [
  { value: 0, name: '极近微距特写', ratio: '局部 90-100%', desc: '镜头距离主体极近，只聚焦当前图片中真实存在的局部细节，如边缘倒角、材质颗粒、皮肤纹理、开孔、纹理、接口或接触细节，背景完全虚化。' },
  { value: 16, name: '标准特写', ratio: '80% 以上', desc: '主体占据画面大部分，强调材质、轮廓、高光、五官、手势或主要功能细节，背景只作为柔和色块存在。' },
  { value: 31, name: '近景主体', ratio: '70-85%', desc: '主体完整轮廓基本可见，边缘高光、材质分区、姿态、表情或主要结构清晰。' },
  { value: 46, name: '中景交互', ratio: '55-70%', desc: '适合手持、桌面操作、人物半身、产品使用场景 or 人机交互，主体与环境保持真实比例。' },
  { value: 61, name: '工作台中全景', ratio: '45-60%', desc: '主体居中，周围桌面、工具、配件、身体局部或环境开始出现，焦点仍锁定主体。' },
  { value: 76, name: '全景展示', ratio: '40-55%', desc: '主体作为主要对象，周围配件、包装、人物动作 or 展示空间更完整。' },
  { value: 91, name: '环境交代', ratio: '35-50%', desc: '环境、工作台、人物动作 or 使用场景清楚交代，但主体仍是视觉主角。' },
  { value: 100, name: '大环境融合', ratio: '20-35%', desc: '主体作为场景中的明确视觉符号，重点表达空间氛围与使用语境。' },
];

const FOCAL_DATA = [
  { range: [24, 35], name: '广角', effect: '空间张力强', desc: '使用广角镜头，增强空间张力和环境包裹感，但必须防止主体边缘被拉伸、比例变形或透视过度夸张。' },
  { range: [35, 50], name: '标准焦段', effect: '接近人眼，自然真实', desc: '使用标准焦段，保持接近人眼的自然透视，适合真实场景、人物、产品与环境关系。' },
  { range: [50, 85], name: '中焦', effect: '主体突出，比例稳定', desc: '使用中焦镜头，保持主体比例稳定，减少广角畸变，适合产品、人物和组合主体。' },
  { range: [85, 135], name: '中长焦', effect: '空间压缩，商业感强', desc: '使用中长焦镜头，形成轻微空间压缩，突出主体，保持结构比例准确，适合商业产品和人像。' },
  { range: [135, 200], name: '长焦', effect: '强压缩，背景扁平化', desc: '使用长焦镜头，产生明显空间压缩和背景分离，但必须防止主体变成扁平贴图或比例失真。' },
];

const APERTURE_DATA = [
  { range: [1.4, 2], name: '超大光圈', effect: '极浅景深', desc: '使用超大光圈，背景产生强烈虚化，但主体关键细节、脸部、产品边缘、Logo、接口 or 手部接触点必须保持清晰。' },
  { range: [2.8, 4], name: '商业浅景深', effect: '主体清晰，背景柔和', desc: '使用商业浅景深，主体清晰突出，背景柔和分离，适合产品和人像商业图。' },
  { range: [5.6, 8], name: '中等景深', effect: '主体和部分环境都清晰', desc: '使用中等景深，主体和近处环境关系清晰，适合产品与手部、桌面 or 空间交互。' },
  { range: [8, 11], name: '清晰展示', effect: '全主体清晰', desc: '使用清晰景深，保持主体整体轮廓、边缘、材质分区和结构细节锐利，避免过强虚化。' },
  { range: [11, 16], name: '深景深', effect: '全画面清晰', desc: '使用深景深，主体与环境都保持较高清晰度，适合空间说明、全景展示和结构记录。' },
];

const LENS_PRESETS = [
  { id: 'macro', name: '微距细节', focal: 100, aperture: 5.6 },
  { id: 'standard', name: '商业产品标准', focal: 85, aperture: 4.0 },
  { id: 'ecommerce', name: '电商白底清晰', focal: 85, aperture: 8.0 },
  { id: 'handheld', name: '人像手持产品', focal: 50, aperture: 2.8 },
  { id: 'environmental', name: '空间环境产品', focal: 35, aperture: 5.6 },
];

// --- 3D Scene Components ---

function SubjectPreview({ imageUrl }: { imageUrl?: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = imageUrl ? useLoader(THREE.TextureLoader, imageUrl) : null;
  
  const materials = useMemo(() => {
    const sideMaterial = new THREE.MeshStandardMaterial({ 
      color: "#ffffff", 
      transparent: true, 
      opacity: 0.2,
      roughness: 0.3,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    }

    const frontMaterial = texture 
      ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 1 })
      : new THREE.MeshStandardMaterial({ color: "#3b82f6", transparent: true, opacity: 0.8 });

    return [
      sideMaterial, // +x (right)
      sideMaterial, // -x (left)
      sideMaterial, // +y (top)
      sideMaterial, // -y (bottom)
      frontMaterial, // +z (front)
      sideMaterial, // -z (back)
    ];
  }, [texture]);
  
  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <group>
        <mesh ref={meshRef} castShadow material={materials}>
          <boxGeometry args={[1.8, 1.8, 1.8]} />
        </mesh>
        <mesh>
          <boxGeometry args={[1.81, 1.81, 1.81]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.1} />
        </mesh>
        {!texture && (
          <mesh position={[0, 0, 0.91]}>
             <planeGeometry args={[0.5, 0.5]} />
             <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
          </mesh>
        )}
      </group>
      <Html position={[0, 1.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[12px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap select-none">上 (TOP)</div>
      </Html>
      <Html position={[0, -1.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[12px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap select-none">下 (BOTTOM)</div>
      </Html>
      <Html position={[-1.1, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[12px] font-black text-white/60 uppercase tracking-widest whitespace-nowrap -rotate-90 select-none">左 (LEFT)</div>
      </Html>
      <Html position={[1.1, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[12px] font-black text-white/60 uppercase tracking-widest whitespace-nowrap rotate-90 select-none">右 (RIGHT)</div>
      </Html>
      <Html position={[0, 0, 1.0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[14px] font-black text-white/80 uppercase tracking-widest whitespace-nowrap bg-black/20 px-2 py-0.5 rounded shadow-sm">正面 (FRONT)</div>
      </Html>
      <Html position={[0, 0, -1.0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[12px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap select-none">背面 (BACK)</div>
      </Html>
    </Float>
  );
}

function Scene({ hAngle, vAngle, distance, imageUrl, showGrid, onAngleChange, onDistanceChange }: { 
  hAngle: number, 
  vAngle: number, 
  distance: number, 
  imageUrl?: string,
  showGrid: boolean,
  onAngleChange: (h: number, v: number) => void,
  onDistanceChange: (d: number) => void
}) {
  const controlsRef = useRef<any>(null);
  const isUpdatingFromParent = useRef(false);

  useEffect(() => {
    if (!controlsRef.current) return;
    isUpdatingFromParent.current = true;
    const radH = (hAngle * Math.PI) / 180;
    const radV = (vAngle * Math.PI) / 180;
    const dist = 1.8 + (distance / 100) * 10;
    const x = dist * -Math.sin(radH) * Math.cos(radV);
    const y = dist * -Math.sin(radV);
    const z = dist * Math.cos(radH) * Math.cos(radV);
    controlsRef.current.object.position.set(x, y, z);
    controlsRef.current.update();
    const timer = setTimeout(() => { isUpdatingFromParent.current = false; }, 16);
    return () => clearTimeout(timer);
  }, [hAngle, vAngle, distance]);

  const lastUpdate = useRef<number>(0);
  const handleControlsChange = () => {
    if (isUpdatingFromParent.current || !controlsRef.current) return;
    const now = Date.now();
    if (now - lastUpdate.current < 16) return;
    lastUpdate.current = now;
    const camera = controlsRef.current.object;
    const pos = camera.position;
    const dist = pos.length();
    let horizontal = (Math.atan2(-pos.x, pos.z) * 180) / Math.PI;
    if (horizontal < 0) horizontal += 360;
    const vertical = (Math.asin(-pos.y / dist) * 180) / Math.PI;
    const rawD = ((dist - 1.8) / 10) * 100;
    const clampedD = Math.min(Math.max(rawD, 0), 100);
    onAngleChange(Math.round(horizontal), Math.round(vertical));
    onDistanceChange(Math.round(clampedD));
  };

  return (
    <>
      <OrbitControls 
        ref={controlsRef}
        enablePan={false} 
        enableZoom={true}
        enableRotate={true}
        makeDefault 
        minDistance={1.5}
        maxDistance={25}
        rotateSpeed={0.8}
        onChange={handleControlsChange}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: 0,
          RIGHT: 0
        }}
      />
      <Environment preset="studio" />
      <color attach="background" args={["#0c0e12"]} />
      <fog attach="fog" args={["#0c0e12", 5, 25]} />
      <Suspense fallback={null}>
        <SubjectPreview imageUrl={imageUrl} />
      </Suspense>
      <ContactShadows position={[0, -1.2, 0]} opacity={0.6} scale={20} blur={2.4} far={4} />
      {showGrid && <Grid position={[0, -1.5, 0]} args={[40, 40]} sectionColor="#444" cellColor="#222" fadeDistance={50} infiniteGrid />}
    </>
  );
}

// --- UI Components ---

function ControlSlider({ label, min, max, step = 1, value, onChange, unit = '', prefix = '', suffix = '' }: any) {
  return (
    <div className="space-y-3 group">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors font-bold uppercase tracking-widest">{label}</label>
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono font-bold text-white group-hover:text-blue-500 transition-colors">{prefix}{value}{unit}</span>
          {suffix && <span className="text-[9px] text-gray-600 font-mono italic ml-1">({suffix})</span>}
        </div>
      </div>
      <div className="relative h-6 flex items-center cursor-pointer">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer accent-blue-500"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(value - min) / (max - min) * 100}%, #1a1a1a ${(value - min) / (max - min) * 100}%, #1a1a1a 100%)`
          }}
        />
      </div>
    </div>
  );
}

const NodeUI = ({ 
  params, 
  setParams, 
  isFullscreen, 
  setIsFullscreen, 
  handleReset, 
  hData, 
  vData, 
  dData, 
  fData, 
  aData, 
  generatedPrompts, 
  connectedImageUrl, 
  data, 
  handleCopy, 
  copied,
  applyPreset,
  showPresets,
  setShowPresets,
  showGrid,
  setShowGrid,
  onDelete,
  isActive = true,
  isInPortal = false
}: any) => {
  const containerClasses = isInPortal 
    ? "fixed inset-0 z-[999999] bg-[#0c0e12] flex flex-col overflow-hidden"
    : `flex flex-col w-full h-full overflow-hidden bg-[#0A0A0A] rounded-[32px] border-2 border-white/10 ${data?.selected ? 'border-blue-500 ring-8 ring-blue-500/10' : ''}`;

  return (
    <div className={containerClasses} id="spatial-view-container">
      {!isInPortal && (
        <NodeResizer 
          minWidth={640} 
          minHeight={500} 
          isVisible={data?.selected} 
          lineClassName="border-transparent" 
          handleClassName="h-3 w-3 bg-white border-2 border-blue-500 rounded-full"
        />
      )}
      
      {!isInPortal && (
        <>
          <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-500" />
          <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-500" />
        </>
      )}

      <div className={`p-4 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0 react-flow__node-draghandle ${isInPortal ? '' : 'spatial-node-header'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Move3d size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight uppercase">3D 空间视角控制器</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500 tracking-widest">V1.0 SPATIAL VIEW</span>
              <div className="w-1 h-1 rounded-full bg-blue-500" />
              <span className="text-[10px] font-mono text-blue-500/80">DYNAMIC PROMPT</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && !isInPortal && (
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 mr-2">
              <button 
                id="btn-subject-product"
                onClick={() => setParams((p: any) => ({ ...p, subjectType: 'product' }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${params.subjectType === 'product' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
              >
                <Box size={14} />
                产品 (PRODUCT)
              </button>
              <button 
                id="btn-subject-person"
                onClick={() => setParams((p: any) => ({ ...p, subjectType: 'person' }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${params.subjectType === 'person' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
              >
                <User size={14} />
                人物 (PERSON)
              </button>
            </div>
          )}
          <button 
            id="btn-fullscreen"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-2 rounded-lg transition-all ${isFullscreen ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-500 hover:text-white'}`}
          >
            {isInPortal ? <X size={20} /> : <Maximize2 size={16} />}
          </button>
          {!isInPortal && (
            <button 
              id="btn-delete-node"
              onClick={onDelete}
              className="p-2 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-all"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 bg-[#0c0e12] overflow-hidden h-full">
        <div className="flex-1 bg-[#0c0e12] relative nodrag overflow-hidden group h-full nowheel">
          <div className="absolute inset-0 w-full h-full">
             {isActive && (
               <Canvas 
                shadows 
                dpr={[1, 2]} 
                gl={{ 
                  antialias: true, 
                  stencil: false, 
                  alpha: true,
                  toneMapping: THREE.NoToneMapping,
                  outputColorSpace: THREE.SRGBColorSpace
                }}
                style={{ width: '100%', height: '100%', display: 'block' }}
                camera={{ fov: 45 }}
               >
                  <PerspectiveCamera makeDefault position={[0, 0, 4]} />
                  <ambientLight intensity={0.8} />
                  <pointLight position={[10, 10, 10]} intensity={1.5} />
                  <directionalLight position={[-5, 5, 5]} intensity={1} castShadow />
                  
                  <Suspense fallback={
                    <Html center>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Loading 3D View...</span>
                      </div>
                    </Html>
                  }>
                     <Scene 
                      hAngle={params.horizontalAngle} 
                      vAngle={params.verticalAngle} 
                      distance={params.cameraDistance} 
                      imageUrl={connectedImageUrl as string}
                      showGrid={showGrid}
                      onAngleChange={(h, v) => setParams((prev: any) => ({ ...prev, horizontalAngle: h, verticalAngle: v }))}
                      onDistanceChange={(d: any) => setParams((prev: any) => ({ ...prev, cameraDistance: d }))}
                     />
                  </Suspense>
               </Canvas>
             )}
          </div>
          
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3 w-full pointer-events-none">
             <div className="text-white/40 font-bold text-[10px] tracking-widest drop-shadow-md select-none bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm uppercase">拖拽正方体改变角度</div>
             <div className="flex items-center gap-2 pointer-events-auto">
                <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2 shadow-2xl">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                   <span className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">View Locked</span>
                </div>
                <button 
                  id="btn-toggle-grid"
                  onClick={() => setShowGrid(!showGrid)}
                  className={`px-3 py-1 backdrop-blur-md border border-white/10 rounded-lg transition-all text-[9px] font-bold shadow-2xl flex items-center gap-1.5 uppercase ${showGrid ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-white/10 text-white/60 hover:text-white'}`}
                >
                  <Box size={10} />
                  Grid: {showGrid ? 'ON' : 'OFF'}
                </button>
                <button 
                  id="btn-reset-view"
                  onClick={handleReset}
                  className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-lg text-white/80 hover:text-white transition-all text-[9px] font-bold hover:bg-white/20 active:scale-95 shadow-2xl flex items-center gap-1.5 uppercase"
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
             </div>
          </div>

          <div className={`absolute bottom-6 left-6 right-6 z-10 flex items-end justify-between pointer-events-none`}>
             <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-black/60 px-2 py-0.5 rounded inline-block">Current Angle</div>
                <div className={`font-mono font-black text-white italic drop-shadow-lg ${isInPortal ? 'text-5xl' : 'text-xl'}`}>
                   {params.horizontalAngle}° H / {params.verticalAngle}° V
                </div>
             </div>
             <div className="flex flex-col items-end gap-1">
                <span className={`font-bold text-blue-500 uppercase drop-shadow-lg ${isInPortal ? 'text-lg' : 'text-[10px]'}`}>{vData?.name}</span>
                <span className={`font-mono text-gray-400 drop-shadow-lg ${isInPortal ? 'text-sm' : 'text-[8px]'}`}>{hData?.name}</span>
             </div>
          </div>
        </div>

        <div className={`${isInPortal ? 'w-[480px]' : 'w-[360px]'} flex flex-col bg-[#0A0A0A] overflow-y-auto nodrag custom-scrollbar border-l border-white/5 shadow-2xl`}>
          <div className="p-6 space-y-6">
            <div className="space-y-6">
              <ControlSlider 
                label="水平角度 (Horizontal)" 
                min={0} 
                max={359} 
                value={params.horizontalAngle} 
                onChange={(v: number) => setParams((p: any) => ({ ...p, horizontalAngle: v }))}
                unit="°"
              />
              <ControlSlider 
                label="垂直角度 (Vertical)" 
                min={-90} 
                max={90} 
                value={params.verticalAngle} 
                onChange={(v: number) => setParams((p: any) => ({ ...p, verticalAngle: v }))}
                unit="°"
              />
              <ControlSlider 
                label="相机距离 (Distance)" 
                min={0} 
                max={100} 
                value={params.cameraDistance} 
                onChange={(v: number) => setParams((p: any) => ({ ...p, cameraDistance: v }))}
                suffix={dData?.ratio}
              />
              <ControlSlider 
                label="光圈 (Aperture)" 
                min={1.4} 
                max={16} 
                step={0.1}
                value={params.aperture} 
                onChange={(v: number) => setParams((p: any) => ({ ...p, aperture: Number(v.toFixed(1)) }))}
                prefix="f/"
                suffix={aData?.name}
              />
            </div>

            <div className={`space-y-4 pt-2 border-t border-white/5`}>
               <div className="flex items-center justify-between">
                 <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Camera size={14} />
                    镜头设定 (Lens Config)
                 </label>
                 <div className="relative">
                   <button 
                    id="btn-show-presets"
                    onClick={() => setShowPresets(!showPresets)}
                    className="text-[11px] text-blue-500 hover:text-blue-400 flex items-center gap-1 font-bold"
                   >
                     PRESET <ChevronDown size={12} />
                   </button>
                   <AnimatePresence>
                     {showPresets && (
                       <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-[#151515] border border-white/10 rounded-xl shadow-2xl z-50 py-2"
                       >
                         {LENS_PRESETS.map(preset => (
                           <button 
                            key={preset.id}
                            onClick={() => applyPreset(preset)}
                            className="w-full px-4 py-2 text-left text-[11px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                           >
                              {preset.name}
                           </button>
                         ))}
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <span className="text-[11px] text-gray-600 font-bold flex items-center gap-1"><RotateCcw size={12} /> 起始视角</span>
                     <div className="relative group/select">
                       <select 
                        id="select-viewpoint"
                        value={params.currentViewpoint}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updates: any = { currentViewpoint: val };
                          
                          if (val === 'front_view') { updates.horizontalAngle = 0; updates.verticalAngle = 0; }
                          else if (val === 'left_front_45') { updates.horizontalAngle = 45; updates.verticalAngle = 0; }
                          else if (val === 'right_front_45') { updates.horizontalAngle = 315; updates.verticalAngle = 0; }
                          else if (val === 'left_side') { updates.horizontalAngle = 90; updates.verticalAngle = 0; }
                          else if (val === 'right_side') { updates.horizontalAngle = 270; updates.verticalAngle = 0; }
                          else if (val === 'rear_view') { updates.horizontalAngle = 180; updates.verticalAngle = 0; }
                          else if (val === 'top_view') { updates.horizontalAngle = 0; updates.verticalAngle = -90; }
                          else if (val === 'low_angle_front') { updates.horizontalAngle = 0; updates.verticalAngle = 30; }
                          
                          setParams((p: any) => ({ ...p, ...updates }));
                        }}
                        className="w-full h-10 bg-[#151515] hover:bg-[#1a1a1a] border border-white/5 rounded-xl px-3 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer transition-all pr-8"
                       >
                         <option value="front_view">正面平视</option>
                         <option value="left_front_45">左前45°</option>
                         <option value="right_front_45">右前45°</option>
                         <option value="left_side">正左侧</option>
                         <option value="right_side">正右侧</option>
                         <option value="rear_view">正后方</option>
                         <option value="top_view">顶视</option>
                         <option value="low_angle_front">前低机位</option>
                         <option value="auto">自动识别</option>
                       </select>
                       <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 group-hover/select:text-white transition-colors">
                         <ChevronDown size={12} />
                       </div>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <span className="text-[11px] text-gray-600 font-bold flex items-center gap-1"><Focus size={12} /> 观察焦点</span>
                     <div className="relative group/select">
                       <select 
                        id="select-focus"
                        value={params.focusAnchor}
                        onChange={(e) => setParams((p: any) => ({ ...p, focusAnchor: e.target.value }))}
                        className="w-full h-10 bg-[#151515] hover:bg-[#1a1a1a] border border-white/5 rounded-xl px-3 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer transition-all pr-8"
                       >
                         <option value="主体中心">主体中心</option>
                         <option value="画面中心">画面中心</option>
                         <option value="主体前部">主体前部</option>
                         <option value="主体左侧">主体左侧</option>
                         <option value="主体右侧">主体右侧</option>
                         <option value="主体顶部">主体顶部</option>
                       </select>
                       <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 group-hover/select:text-white transition-colors">
                         <ChevronDown size={12} />
                       </div>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <span className="text-[11px] text-gray-600 font-bold flex items-center gap-1"><Focus size={12} /> Focal</span>
                    <div className="h-10 bg-white/2 border border-white/5 rounded-xl flex items-center px-3 justify-between group-hover:border-white/10 transition-all">
                       <input 
                        id="input-focal-length"
                        type="number" 
                        value={params.focalLength} 
                        onChange={(e) => setParams((p: any) => ({ ...p, focalLength: Number(e.target.value) }))}
                        className="bg-transparent text-sm text-white font-mono w-16 focus:outline-none"
                       />
                       <span className="text-[10px] text-gray-500 italic">mm</span>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <span className="text-[11px] text-gray-600 font-bold flex items-center gap-1"><ApertureIcon size={12} /> Aperture</span>
                    <div className="h-10 bg-white/2 border border-white/5 rounded-xl flex items-center px-3 justify-between group-hover:border-white/10 transition-all">
                       <span className="text-[10px] text-gray-500 italic">f/</span>
                       <input 
                        id="input-aperture"
                        type="number" 
                        step="0.1"
                        value={params.aperture} 
                        onChange={(e) => setParams((p: any) => ({ ...p, aperture: Number(e.target.value) }))}
                        className="bg-transparent text-sm text-white font-mono w-16 focus:outline-none text-right"
                       />
                    </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`p-6 bg-black/40 border-t border-white/5 space-y-4 shrink-0`}>
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest text-shadow-glow">Output Prompt</span>
              <div className="px-2 py-0.5 bg-blue-500/10 rounded border border-blue-500/20 text-[8px] font-bold text-blue-500 italic">DYNAMIC GENERATED</div>
           </div>
           <button 
             id="btn-copy-prompt"
             onClick={() => handleCopy(generatedPrompts.full)}
             className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black transition-all shadow-lg shadow-blue-600/20 active:scale-95"
           >
             {copied ? <Check size={16} /> : <Copy size={16} />}
             {copied ? 'COPIED' : 'COPY PROMPT'}
           </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
              <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest">Full Narrative Description</span>
              <div className={`bg-white/2 border border-white/5 rounded-2xl p-4 ${isInPortal ? 'h-48' : 'h-32'} overflow-y-auto text-[12px] text-gray-400 font-sans leading-relaxed custom-scrollbar italic`}>
                 {generatedPrompts.full}
              </div>
           </div>
           <div className="space-y-2">
              <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest">Compact Tag List</span>
              <div className={`bg-white/2 border border-white/5 rounded-2xl p-4 ${isInPortal ? 'h-48' : 'h-32'} overflow-y-auto font-mono text-[11px] text-blue-500/70 leading-relaxed custom-scrollbar`}>
                 {generatedPrompts.compact}
              </div>
           </div>
        </div>
      </div>

      <div className="px-6 py-3 bg-[#080808] border-t border-white/5 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
               <Info size={14} className="text-gray-500" />
               <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Subject DNA:</span>
               <span className="text-[11px] text-blue-500/80 font-mono italic">ACTIVE PROTECT</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
               <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Perspective:</span>
               <span className="text-[11px] text-gray-400 font-mono">{fData?.name} ({fData?.effect})</span>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-600 font-mono">NEXT VISION CORE 5.0</span>
         </div>
      </div>
    </div>
  );
};

export const SpatialViewNode = React.memo(({ id, data }: { id: string; data: any }) => {
  const { updateNodeData } = useStore();
  const { deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  
  const connectedImageUrl = useMemo(() => {
    const incomingEdge = edges.find(e => e.target === id);
    if (!incomingEdge) return undefined;
    const sourceNode = nodes.find(n => n.id === incomingEdge.source);
    return sourceNode?.data?.imageUrl || sourceNode?.data?.url;
  }, [edges, nodes, id]);
  
  const defaultParams = {
    subjectType: 'product',
    horizontalAngle: 45,
    verticalAngle: 0,
    cameraDistance: 31,
    focalLength: 85,
    aperture: 4.0,
    focusAnchor: '主体中心',
    customFocusAnchor: '',
    scaleDna: 'auto',
    activePreset: 'standard',
    currentViewpoint: 'front_view'
  };

  const [params, setParams] = useState({
    subjectType: data.subjectType || defaultParams.subjectType,
    horizontalAngle: data.horizontalAngle || defaultParams.horizontalAngle,
    verticalAngle: data.verticalAngle || defaultParams.verticalAngle,
    cameraDistance: data.cameraDistance || defaultParams.cameraDistance,
    focalLength: data.focalLength || defaultParams.focalLength,
    aperture: data.aperture || defaultParams.aperture,
    focusAnchor: data.focusAnchor || defaultParams.focusAnchor,
    customFocusAnchor: data.customFocusAnchor || defaultParams.customFocusAnchor,
    scaleDna: data.scaleDna || defaultParams.scaleDna,
    activePreset: data.activePreset || defaultParams.activePreset,
    currentViewpoint: data.currentViewpoint || defaultParams.currentViewpoint
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showGrid, setShowGrid] = useState(data.showGrid !== undefined ? data.showGrid : true);
  const [copied, setCopied] = useState(false);

  const handleReset = () => { setParams(defaultParams); };
  
  const handleDelete = React.useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [id, deleteElements]);

  const hData = useMemo(() => {
    return HORIZONTAL_DATA.find(d => params.horizontalAngle >= d.range[0] && params.horizontalAngle < d.range[1]) || HORIZONTAL_DATA[HORIZONTAL_DATA.length - 1];
  }, [params.horizontalAngle]);

  const fData = useMemo(() => {
    return FOCAL_DATA.find(d => params.focalLength >= d.range[0] && params.focalLength <= d.range[1]) || FOCAL_DATA[2];
  }, [params.focalLength]);

  const aData = useMemo(() => {
    return APERTURE_DATA.find(d => params.aperture >= d.range[0] && params.aperture <= d.range[1]) || APERTURE_DATA[1];
  }, [params.aperture]);

  const vData = useMemo(() => {
    const angle = params.verticalAngle;
    return VERTICAL_DATA.reduce((prev, curr) => 
      Math.abs(curr.angle - angle) < Math.abs(prev.angle - angle) ? curr : prev
    );
  }, [params.verticalAngle]);

  const dData = useMemo(() => {
    const dist = params.cameraDistance;
    return DISTANCE_DATA.reduce((prev, curr) => 
      Math.abs(curr.value - dist) < Math.abs(prev.value - dist) ? curr : prev
    );
  }, [params.cameraDistance]);

  const currentViewData = useMemo(() => {
    return CURRENT_VIEWPOINT_DATA.find(d => d.id === params.currentViewpoint) || CURRENT_VIEWPOINT_DATA[0];
  }, [params.currentViewpoint]);

  const generatedPrompts = useMemo(() => {
    const horizontal = hData;
    const vertical = vData;
    const distance = dData;
    const focal = fData;
    const aperture = aData;
    const focus = FOCUS_POINT_DATA.find(d => d.name === params.focusAnchor) || FOCUS_POINT_DATA[0];

    const targetViewSummary = `${horizontal.name} + ${vertical.name}`;

    const fullPromptTemplate = `【Reference Image Binding｜参考图绑定】
当前参考图是唯一的主体与视角参考来源。保持参考图中的主体身份、外观、结构、比例、轮廓、材质关系、构图中心和核心空间逻辑不变。允许可见面比例、边缘遮挡、透视方向、前后层级和空间显露关系根据目标相机视角发生合理变化，但不得改变参考图主体本身，不得重新设计主体，不得凭空新增参考图中没有依据的结构细节。

【Current Viewpoint｜当前参考视角】
${currentViewData.desc}该视角作为本次相机视角转换的起始视角参考。

【Target Camera Transformation｜目标相机视角变换】
将相机从当前参考视角移动到目标相机位置：${horizontal.name}，目标水平角度为 ${params.horizontalAngle}°，目标垂直角度为 ${params.verticalAngle}°，形成「${targetViewSummary}」的目标视角。${horizontal.desc}${vertical.desc}新的画面应根据目标相机位置重新呈现主体的可见面比例、透视方向、边缘遮挡和空间层级。

【View Transformation Rule｜视角变换规则】
本次任务的核心是改变相机观察位置，而不是改变主体本身。主体必须保持一致，只改变观察方向、观察高度、观察距离、焦距透视和景深表现，使画面从当前参考图视角自然转换到目标视角。

【Camera Distance & Framing｜相机距离与景别】
${distance.desc}主体画面占比参考：${distance.ratio}。

【Focal Length｜焦距】
${focal.desc}

【Aperture & Depth of Field｜光圈与景深】
${aperture.desc}

【Focus Point｜焦点位置】
焦点锁定在当前参考图的“${params.focusAnchor}”。该焦点只作为观察重点，不改变参考图中的主体结构、位置或画面内容。

【Spatial Consistency｜空间一致性】
保持参考图原有主体的一致性、构图中心和核心空间逻辑。相机可以围绕主体改变观察方向、高度、距离和镜头透视，但不得造成主体变形、身份漂移、结构重塑、比例异常或构图中心严重偏移。目标视角中的可见面、遮挡边缘和前后层级必须符合新的相机位置逻辑。

【Negative Spatial Constraints｜反向空间约束】
${NEGATIVE_SPATIAL_CONSTRAINTS.join('，')}。`;

    const compactTemplate = `Keep the reference subject unchanged. Transform the camera viewpoint from "${currentViewData.name}" to "${targetViewSummary}". Horizontal angle: ${params.horizontalAngle}°. Vertical angle: ${params.verticalAngle}°. ${horizontal.desc} ${vertical.desc} ${distance.name}, ${distance.ratio}. ${focal.name}: ${focal.effect}. ${aperture.name}: ${aperture.effect}. No deformation, no identity drift, no wrong side, no left-right flip, no front-back confusion, no wrong target viewpoint.`;

    const negativeTemplate = `subject deformation, distorted proportions, left-right flip, front-back confusion, wrong side view, incorrect vertical angle, over-rotated subject, invented non-existing parts, identity change, changed pose.`;

    const jsonTemplate = `{
  "reference_image_centered": true,
  "preserve_subject": true,
  "preserve_composition_center": true,
  "current_viewpoint": "${params.currentViewpoint}",
  "target_horizontal_angle": ${params.horizontalAngle},
  "target_vertical_angle": ${params.verticalAngle},
  "camera_distance": ${params.cameraDistance},
  "focal_length": "${params.focalLength}mm",
  "aperture": "f/${params.aperture}",
  "focus_point": "${params.focusAnchor}"
}`;

    return {
      full: fullPromptTemplate,
      compact: compactTemplate,
      negative: negativeTemplate,
      json: jsonTemplate
    };
  }, [params, hData, vData, dData, fData, aData, currentViewData]);

  useEffect(() => {
    updateNodeData(id, { 
      ...params, 
      showGrid,
      prompt: generatedPrompts.full,
      compactPrompt: generatedPrompts.compact,
      negativePrompt: generatedPrompts.negative,
      configJson: generatedPrompts.json
    });
  }, [params, generatedPrompts, id, updateNodeData, showGrid]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (preset: typeof LENS_PRESETS[0]) => {
    setParams(prev => ({
      ...prev,
      activePreset: preset.id,
      focalLength: preset.focal,
      aperture: preset.aperture
    }));
    setShowPresets(false);
  };

  const nodeProps = {
    params, setParams, isFullscreen, setIsFullscreen, handleReset,
    hData, vData, dData, fData, aData, generatedPrompts,
    connectedImageUrl, data, handleCopy, copied, applyPreset,
    showPresets, setShowPresets, showGrid, setShowGrid,
    onDelete: handleDelete
  };

  return (
    <>
      <div style={{ width: '100%', height: '100%', visibility: isFullscreen ? 'hidden' : 'visible' }}>
        <NodeUI {...nodeProps} isActive={!isFullscreen} isInPortal={false} />
      </div>
      {isFullscreen && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black flex items-center justify-center">
           <div className="w-full h-full relative">
              <NodeUI {...nodeProps} isActive={true} isInPortal={true} />
           </div>
        </div>,
        document.body
      )}
    </>
  );
});

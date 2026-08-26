const $ = id => document.getElementById(id);
const EPS = 1e-12;
const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = a => Math.hypot(...a);
const scale = (a,s) => a.map(v => v*s);
const normalized = a => scale(a, 1/norm(a));
const readPoint = prefix => ["x","y","z"].map(axis => Number($(prefix+axis).value));
const validPoint = p => p.every(Number.isFinite);
const validId = id => /^[A-Za-z_][A-Za-z0-9_]*$/.test(id);
const clean = (v,p) => {
  if (Math.abs(v) < Math.pow(10,-p)) v = 0;
  return Number(v.toFixed(p)).toString();
};
const vectorText = (v,p) => `(${v.map(x=>clean(x,p)).join(", ")})`;
const showMessage = (id,text,type="error") => {
  const el=$(id); el.textContent=text; el.className=`message ${type} show`;
};
const clearMessage = id => { const el=$(id); el.className="message error"; el.textContent=""; };
const regionPlane = (id,p,n,side,units,precision) =>
  `region ${id} plane ${[...p,...n].map(v=>clean(v,precision)).join(" ")} side ${side} units ${units}`;
const atomskArg = value => `"${value.replaceAll('"',"")}"`;
const rotationToZ = n => {
  const cosine=Math.max(-1,Math.min(1,n[2]));
  if (cosine>1-EPS) return {axis:[1,0,0], angle:0};
  if (cosine<-1+EPS) return {axis:[1,0,0], angle:180};
  return {
    axis:normalized(cross(n,[0,0,1])),
    angle:Math.acos(cosine)*180/Math.PI
  };
};

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.tab).classList.add("active");
  });
});

$("planeMode").addEventListener("change", () => {
  const line = $("planeMode").value === "line";
  $("thirdLabel").textContent = line ? "E" : "C";
  $("thirdHelp").textContent = line
    ? "E 是平面的延伸方向向量。例如从 X 方向观察 Y–Z 边界线时，填写 E=(1,0,0)。"
    : "C 是平面上的第三个原子，A、B、C 不能共线。";
});
$("useInside").addEventListener("change", () => $("insideFields").classList.toggle("hidden", !$("useInside").checked));

$("calcPlane").addEventListener("click", () => {
  clearMessage("planeMessage");
  const A=readPoint("a"), B=readPoint("b"), C=readPoint("c");
  const id=$("planeId").value.trim(), precision=Number($("planePrecision").value), units=$("planeUnits").value;
  const selectedSide=$("planeSide").value;
  const atomskInput=$("atomskInput").value.trim(), atomskOutput=$("atomskOutput").value.trim();
  const atomskTolerance=Number($("atomskTolerance").value);
  if (![A,B,C].every(validPoint)) return showMessage("planeMessage","请完整输入所有坐标值。");
  if (!validId(id)) return showMessage("planeMessage","LAMMPS 区域名称只能包含英文字母、数字和下划线，且不能以数字开头。");
  if (!["in","out"].includes(selectedSide)) return showMessage("planeMessage","请选择有效的半空间方向。");
  if (!atomskInput || !atomskOutput) return showMessage("planeMessage","请填写 Atomsk 输入文件和输出文件名。");
  if (!Number.isFinite(atomskTolerance) || atomskTolerance<0) return showMessage("planeMessage","Atomsk 平面容差必须是大于或等于 0 的数值。");
  const u=sub(B,A);
  const mode=$("planeMode").value;
  let n = mode==="three" ? cross(u,sub(C,A)) : cross(u,C);
  if (norm(n)<EPS) return showMessage("planeMessage", mode==="three" ? "三个点共线或过于接近，无法确定唯一平面。" : "延伸方向与 A→B 平行，无法确定唯一平面。");
  n=normalized(n);
  let orientationNote="";
  if ($("useInside").checked) {
    const Q=readPoint("q");
    if (!validPoint(Q)) return showMessage("planeMessage","请完整输入内部测试点 Q。");
    const s=dot(n,sub(Q,A));
    if (s<0) { n=scale(n,-1); orientationNote="法向量已自动翻转，使测试点 Q 位于 side in。"; }
    else if (Math.abs(s)<1e-10) orientationNote="注意：测试点 Q 位于平面上，不能判定哪一侧为内部。";
    else orientationNote="测试点 Q 位于 side in，法向量方向无需翻转。";
  }
  const D=-dot(n,A);
  $("normalOut").textContent=vectorText(n,precision);
  $("constantOut").textContent=clean(D,precision);
  $("equationOut").textContent=`${clean(n[0],precision)}x + ${clean(n[1],precision)}y + ${clean(n[2],precision)}z + ${clean(D,precision)} = 0`;
  const oppositeSide=selectedSide==="in" ? "out" : "in";
  const selectedRegionId=`${id}_${selectedSide}`, oppositeRegionId=`${id}_${oppositeSide}`;
  const selectedIsIn=selectedSide==="in";
  const sideName=selectedIsIn ? "+n 方向一侧" : "−n 方向一侧";
  const sideRelation=selectedIsIn ? "≥" : "<";
  $("sideLabel").textContent=`LAMMPS 保留条件（side ${selectedSide}）`;
  $("sideOut").textContent=`n·(X−A) ${sideRelation} 0`;
  const method = mode==="three"
    ? `平面由三个原子 A、B、C 确定。\n坐标：A=${vectorText(A,precision)}，B=${vectorText(B,precision)}，C=${vectorText(C,precision)}。`
    : `平面由边界线 A→B 和延伸方向 E 确定。\n坐标：A=${vectorText(A,precision)}，B=${vectorText(B,precision)}，E=${vectorText(C,precision)}。`;
  $("planeExplanation").textContent =
`${method}
单位法向量：n=${vectorText(n,precision)}。
平面方程：n·(X−A)=0。
${orientationNote ? orientationNote+"\n" : ""}所选半空间：${sideName}（side ${selectedSide}），满足 n·(X−A) ${sideRelation} 0。
主原子组为 ${id}_atoms；互补一侧为 ${id}_opposite。`;
  $("planeCode").textContent =
`${regionPlane(selectedRegionId,A,n,selectedSide,units,precision)}
group ${id}_atoms region ${selectedRegionId}

${regionPlane(oppositeRegionId,A,n,oppositeSide,units,precision)}
group ${id}_opposite region ${oppositeRegionId}

variable n_${id} equal count(${id}_atoms)
run 0
print "Selected atoms = \${n_${id}}"
write_dump ${id}_atoms custom ${id}_atoms.lammpstrj id type x y z`;
  const rotation=rotationToZ(n);
  const shiftToOrigin=A.map(v=>clean(-v,precision)).join(" ");
  const shiftBack=A.map(v=>clean(v,precision)).join(" ");
  const rotationAxis=rotation.axis.map(v=>clean(v,precision)).join(" ");
  const angle=clean(rotation.angle,precision);
  const inverseAngle=clean(-rotation.angle,precision);
  const cutDistance=clean(atomskTolerance,precision);
  const atomskCutDirection=selectedIsIn ? "above" : "below";
  const atomskCutDistance=clean(selectedIsIn ? atomskTolerance : -atomskTolerance,precision);
  const rotateForward=rotation.angle<EPS ? "" : ` -rotate ${rotationAxis} ${angle}`;
  const rotateBackward=rotation.angle<EPS ? "" : ` -rotate ${rotationAxis} ${inverseAngle}`;
  $("atomskHeading").textContent=`Atomsk 删除命令：删除${sideName}（side ${selectedSide}）`;
  $("atomskExplanation").textContent =
`删除与 LAMMPS side ${selectedSide} 对应的${sideName}，即 n·(X−A) ${sideRelation} 0 的半空间。
距平面 ${cutDistance} Å 内的原子将保留，避免旋转和舍入误差造成误删。
处理流程：平移到原点 → 将法向量旋转到 +Z → 从 ${atomskCutDirection} 方向切割 → 逆旋转并平移回原位。`;
  $("atomskCode").textContent =
`atomsk ${atomskArg(atomskInput)} -shift ${shiftToOrigin}${rotateForward} -cut ${atomskCutDirection} ${atomskCutDistance} z${rotateBackward} -shift ${shiftBack} ${atomskArg(atomskOutput)}`;
});

$("planeExample").addEventListener("click", () => {
  $("planeMode").value="line"; $("planeMode").dispatchEvent(new Event("change"));
  [["ax",0],["ay",100],["az",50],["bx",0],["by",200],["bz",250],["cx",1],["cy",0],["cz",0]].forEach(([id,v])=>$(id).value=v);
  $("planeId").value="yz_boundary";
  $("calcPlane").click();
});

const HEXA_POINT_NAMES=["A","B","C","D","E","F","G","H"];
const HEXA_BASE_PREFIXES=["ha","hb","hc","hd"];
const HEXA_FACE_DEFINITIONS=[
  {label:"底面 A-B-C-D",indices:[0,1,2,3]},
  {label:"平行面 E-F-G-H",indices:[4,5,6,7]},
  {label:"侧面 A-B-F-E",indices:[0,1,5,4]},
  {label:"侧面 B-C-G-F",indices:[1,2,6,5]},
  {label:"侧面 C-D-H-G",indices:[2,3,7,6]},
  {label:"侧面 D-A-E-H",indices:[3,0,4,7]}
];

function averagePoint(points) {
  return points.reduce((sum,point)=>add(sum,point),[0,0,0]).map(value=>value/points.length);
}

function buildHexaFace(points,definition,center,tolerance) {
  const vertices=definition.indices.map(index=>points[index]);
  let n=cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0]));
  if (norm(n)<EPS) throw new Error(`${definition.label} 的前三个点共线，无法确定平面。`);
  n=normalized(n);
  const fourthDistance=Math.abs(dot(n,sub(vertices[3],vertices[0])));
  if (fourthDistance>tolerance) {
    throw new Error(`${definition.label} 的四个点不共面：第 4 点距前三点平面 ${fourthDistance} Å，超过容差 ${tolerance} Å。`);
  }
  for (let index=0;index<4;index++) {
    const edge1=sub(vertices[(index+1)%4],vertices[index]);
    const edge2=sub(vertices[(index+2)%4],vertices[(index+1)%4]);
    const turn=cross(edge1,edge2);
    if (norm(turn)<EPS || dot(normalized(turn),n)<1e-8) {
      throw new Error(`${definition.label} 的顶点没有沿四边形边界连续排列，或该面不是凸四边形。请按界面给出的字母顺序重新选择原子。`);
    }
  }
  const centerDistance=dot(n,sub(center,vertices[0]));
  if (Math.abs(centerDistance)<=Math.max(tolerance,EPS)) {
    throw new Error(`${definition.label} 穿过六面体中心，顶点对应关系可能不正确。`);
  }
  if (centerDistance<0) n=scale(n,-1);
  return {label:definition.label,indices:definition.indices,point:vertices[0],n,fourthDistance};
}

function hexaVolume(points,faces,center) {
  let volume=0;
  faces.forEach(face => {
    [[0,1,2],[0,2,3]].forEach(triangle => {
      const [a,b,c]=triangle.map(localIndex=>points[face.indices[localIndex]]);
      volume+=Math.abs(dot(sub(a,center),cross(sub(b,center),sub(c,center))))/6;
    });
  });
  return volume;
}

function atomskCutOutsideFace(face,tolerance,precision) {
  const rotation=rotationToZ(face.n);
  const shiftToOrigin=face.point.map(value=>clean(-value,precision)).join(" ");
  const shiftBack=face.point.map(value=>clean(value,precision)).join(" ");
  const rotationAxis=rotation.axis.map(value=>clean(value,precision)).join(" ");
  const operations=[`-shift ${shiftToOrigin}`];
  if (rotation.angle>=EPS) operations.push(`-rotate ${rotationAxis} ${clean(rotation.angle,precision)}`);
  operations.push(`-cut below ${clean(-tolerance,precision)} z`);
  if (rotation.angle>=EPS) operations.push(`-rotate ${rotationAxis} ${clean(-rotation.angle,precision)}`);
  operations.push(`-shift ${shiftBack}`);
  return operations.join(" ");
}

function calculateHexahedron() {
  clearMessage("hexaMessage");
  try {
    const basePoints=HEXA_BASE_PREFIXES.map(readPoint);
    if (!basePoints.every(validPoint)) throw new Error("请完整输入 A、B、C、D 四个底面顶点坐标。");
    const id=$("hexaId").value.trim();
    const precision=Number($("hexaPrecision").value), units=$("hexaUnits").value;
    const tolerance=Number($("hexaTolerance").value);
    const thickness=Number($("hexaThickness").value);
    const extrudeDirection=$("hexaExtrudeDirection").value;
    const atomskTolerance=Number($("hexaAtomskTolerance").value);
    const atomskInput=$("hexaAtomskInput").value.trim();
    const atomskOutput=$("hexaAtomskOutput").value.trim();
    if (!validId(id)) throw new Error("LAMMPS 区域名称只能包含英文字母、数字和下划线，且不能以数字开头。");
    if (!Number.isFinite(tolerance) || tolerance<0) throw new Error("共面与几何检查容差必须是大于或等于 0 的数值。");
    if (!Number.isFinite(thickness) || thickness<=Math.max(tolerance,EPS)) throw new Error("六面体厚度必须大于几何检查容差。");
    if (!["positive","negative"].includes(extrudeDirection)) throw new Error("请选择有效的厚度延伸方向。");
    if (!Number.isFinite(atomskTolerance) || atomskTolerance<0) throw new Error("Atomsk 边界保护距离必须是大于或等于 0 的数值。");
    if (!atomskInput || !atomskOutput) throw new Error("请填写 Atomsk 输入文件和输出文件名。");
    for (let i=0;i<basePoints.length;i++) {
      for (let j=i+1;j<basePoints.length;j++) {
        if (norm(sub(basePoints[i],basePoints[j]))<=Math.max(tolerance,EPS)) {
          throw new Error(`顶点 ${HEXA_POINT_NAMES[i]} 与 ${HEXA_POINT_NAMES[j]} 重合或距离小于几何容差。`);
        }
      }
    }

    let extrusionNormal=cross(sub(basePoints[1],basePoints[0]),sub(basePoints[2],basePoints[0]));
    if (norm(extrusionNormal)<EPS) throw new Error("A、B、C 三点共线或过于接近，无法确定底面法向。");
    extrusionNormal=normalized(extrusionNormal);
    if (extrudeDirection==="negative") extrusionNormal=scale(extrusionNormal,-1);
    const extrusionVector=scale(extrusionNormal,thickness);
    const generatedPoints=basePoints.map(point=>add(point,extrusionVector));
    const points=[...basePoints.map(point=>[...point]),...generatedPoints];
    const center=averagePoint(points);
    const faces=HEXA_FACE_DEFINITIONS.map(definition=>buildHexaFace(points,definition,center,tolerance));
    faces.forEach(face => {
      points.forEach((point,index) => {
        const distance=dot(face.n,sub(point,face.point));
        if (distance<-tolerance-1e-10) {
          throw new Error(`顶点 ${HEXA_POINT_NAMES[index]} 位于 ${face.label} 的外侧。A、B、C、D 可能没有沿凸四边形边界连续排列。`);
        }
      });
    });
    const volume=hexaVolume(points,faces,center);
    if (!Number.isFinite(volume) || volume<=EPS) throw new Error("六面体体积为 0 或过小，请检查底面四点与厚度。");

    const faceIds=faces.map((_,index)=>`${id}_f${index+1}`);
    const planeLines=faces.map((face,index)=>regionPlane(faceIds[index],face.point,face.n,"in",units,precision));
    const faceSummary=faces.map((face,index)=>`${faceIds[index]}（${face.label}）：n=${vectorText(face.n,precision)}`).join("\n");
    const generatedSummary=generatedPoints.map((point,index)=>`${HEXA_POINT_NAMES[index+4]}=${vectorText(point,precision)}`).join("，");
    const atomskCuts=faces.map(face=>atomskCutOutsideFace(face,atomskTolerance,precision));

    $("hexaVolumeOut").textContent=`${clean(volume,precision)} Å³`;
    $("hexaParallelOut").textContent=`n=${vectorText(extrusionNormal,precision)}；t=${clean(thickness,precision)} Å`;
    $("hexaGeometryOut").textContent="ABCD 共面且凸；EFGH 自动平行";
    $("hexaExplanation").textContent =
`底面顺序：A→B→C→D；有向单位法向量 n=${vectorText(extrusionNormal,precision)}，厚度 t=${clean(thickness,precision)} Å。
自动生成平行面：${generatedSummary}。
连接边 A–E、B–F、C–G、D–H 均平行于 n，长度均为 t；因此两个端面严格平行。
六面体中心：${vectorText(center,precision)}；体积：${clean(volume,precision)} Å³。
六个面的方向均已自动转向内部，因此全部使用 side in：
${faceSummary}
六个半空间通过 intersect 6 取交集，得到六面体内部原子。`;
    $("hexaCode").textContent =
`${planeLines.join("\n")}

region ${id} intersect 6 ${faceIds.join(" ")}
group ${id}_atoms region ${id}
group ${id}_outside subtract all ${id}_atoms

variable n_${id} equal count(${id}_atoms)
run 0
print "Atoms inside hexahedron = \${n_${id}}"
write_dump ${id}_atoms custom ${id}_atoms.lammpstrj id type x y z`;
    $("hexaAtomskExplanation").textContent =
`Atomsk 按六个面依次裁剪。每个面的内侧条件与 LAMMPS side in 相同，即 n·(X−P) ≥ 0。
处理每个面时先将面上点 P 平移到原点，再把内向法向 n 旋转到 +Z；-cut below ${clean(-atomskTolerance,precision)} z 删除外侧，并保留距边界 ${clean(atomskTolerance,precision)} Å 内的原子，随后逆旋转并平移回原坐标。
完成六轮裁剪后，输出文件只保留六面体内部原子。`;
    $("hexaAtomskCode").textContent =
`atomsk ${atomskArg(atomskInput)} ${atomskCuts.join(" ")} ${atomskArg(atomskOutput)}`;
  } catch(e) {
    $("hexaVolumeOut").textContent="—";
    $("hexaParallelOut").textContent="—";
    $("hexaGeometryOut").textContent="未通过";
    $("hexaExplanation").textContent="请根据左侧提示修正底面四点、厚度或几何容差。";
    $("hexaCode").textContent="请修正输入参数后重新计算。";
    $("hexaAtomskExplanation").textContent="几何参数通过检查后才会生成 Atomsk 六面裁剪说明。";
    $("hexaAtomskCode").textContent="请修正输入参数后重新计算。";
    showMessage("hexaMessage",e.message);
  }
}

$("calcHexa").addEventListener("click",calculateHexahedron);
$("hexaExample").addEventListener("click", () => {
  const values={
    hax:0,hay:0,haz:0,hbx:0,hby:10,hbz:0,hcx:0,hcy:10,hcz:10,hdx:0,hdy:0,hdz:10
  };
  Object.entries(values).forEach(([fieldId,value])=>$(fieldId).value=value);
  $("hexaThickness").value=12;
  $("hexaExtrudeDirection").value="positive";
  $("hexaId").value="hexa";
  calculateHexahedron();
});

function getLayerGeometry() {
  const A=readPoint("la"), B=readPoint("lb"), C=readPoint("lc");
  if (![A,B,C].every(validPoint)) throw new Error("请完整输入倾斜面 A、B、C 的坐标。");
  let n=cross(sub(B,A),sub(C,A));
  if (norm(n)<EPS) throw new Error("倾斜面的三个点共线或过于接近，无法确定唯一平面。");
  n=normalized(n);
  if ($("layerNormalDirection").value==="reverse") n=scale(n,-1);
  const precision=Number($("layerPrecision").value);
  return {A,B,C,n,precision};
}

function projectedUnitDirection(reference,n,errorMessage) {
  if (!validPoint(reference)) throw new Error(errorMessage);
  const projected=sub(reference,scale(n,dot(reference,n)));
  if (norm(projected)<EPS) throw new Error("所选方向与倾斜面法向平行或长度过小，无法得到面内方向。");
  return normalized(projected);
}

function getLayerLimit(geometry) {
  const {A,B,C,n,precision}=geometry;
  const enabled=$("useLayerLimit").checked;
  const source=enabled ? $("layerLimitDirection").value : "ab";
  let reference,sourceName;
  if (source==="ab") { reference=sub(B,A); sourceName="A→B"; }
  else if (source==="ac") { reference=sub(C,A); sourceName="A→C"; }
  else { reference=readPoint("lv"); sourceName="自定义向量 M"; }
  const m=projectedUnitDirection(reference,n,"请完整输入自定义裁剪方向向量 M。");
  const side=enabled ? $("layerLimitSide").value : "greater";
  const relation=side==="greater" ? "≥" : "<";
  const regionSide=side==="greater" ? "in" : "out";
  const id=$("layerLimitId").value.trim();
  if (enabled && !validId(id)) throw new Error("侧边界区域名称只能包含英文字母、数字和下划线，且不能以数字开头。");

  let S,K,mode=enabled ? $("layerLimitMode").value : "point";
  if (!enabled) {
    S=[...A];
    K=dot(m,S);
  } else if (mode==="point") {
    S=readPoint("ls");
    if (!validPoint(S)) throw new Error("请完整输入裁剪平面经过点 S。");
    K=dot(m,S);
  } else {
    K=Number($("layerLimitK").value);
    if (!Number.isFinite(K)) throw new Error("裁剪阈值 K 必须是有效数值。");
    const q0=K-dot(m,A);
    S=add(A,scale(m,q0));
  }
  return {
    enabled,sourceName,m,S,K,mode,id,side,relation,regionSide,
    q0:dot(m,sub(S,A)),
    condition:`m·X ${relation} ${clean(K,precision)}`
  };
}

function getLayerGroupIds() {
  const upperGroup=$("upperUnionGroup").value.trim();
  const lowerGroup=$("lowerUnionGroup").value.trim();
  const remainingGroup=$("moveGroup").value.trim();
  const ids=[upperGroup,lowerGroup,remainingGroup];
  if (!ids.every(validId)) throw new Error("LAMMPS 原子组名称只能包含英文字母、数字和下划线，且不能以数字开头。");
  if (ids.includes("all")) throw new Error("all 是 LAMMPS 内置原子组，不能用作这里的输出组 ID。");
  if (new Set(ids).size!==ids.length) throw new Error("上层、下层和其余原子组 ID 必须互不相同。");
  return {upperGroup,lowerGroup,remainingGroup};
}

function getLayerConfiguration() {
  const count=Number($("layerCount").value);
  if (!Number.isInteger(count) || count<1 || count>20) throw new Error("上下层排数必须是 1 到 20 之间的整数。");
  const tolerance=Number($("layerTolerance").value);
  if (!Number.isFinite(tolerance) || tolerance<0) throw new Error("中心面每侧的留空距离必须是大于或等于 0 的数值。");
  const upperPrefix=$("upperPrefix").value.trim(), lowerPrefix=$("lowerPrefix").value.trim();
  if (![upperPrefix,lowerPrefix].every(validId)) throw new Error("上下层名称前缀只能包含英文字母、数字和下划线，且不能以数字开头。");
  const thicknesses=[];
  for (let i=1;i<=count;i++) {
    const upper=Number($("upperThickness"+i)?.value), lower=Number($("lowerThickness"+i)?.value);
    if (!Number.isFinite(upper) || upper<=0 || !Number.isFinite(lower) || lower<=0) {
      throw new Error(`第 ${i} 排的上层和下层厚度都必须是大于 0 的数值。`);
    }
    thicknesses.push({upper,lower});
  }
  const upperIds=thicknesses.map((_,i)=>`${upperPrefix}_${i+1}`);
  const lowerIds=thicknesses.map((_,i)=>`${lowerPrefix}_${i+1}`);
  const {upperGroup,lowerGroup,remainingGroup}=getLayerGroupIds();
  const groupIds=[...upperIds,...lowerIds,upperGroup,lowerGroup,remainingGroup];
  if (new Set(groupIds).size!==groupIds.length) throw new Error("自动生成的层名称与总原子组名称重复，请修改高级命名设置。");
  const regionIds=[...upperIds,...lowerIds].flatMap(id=>[id,`${id}_lo`,`${id}_hi`]);
  if (new Set(regionIds).size!==regionIds.length) throw new Error("上下层名称前缀会生成重复区域，请修改高级命名设置。");
  return {count,tolerance,thicknesses,upperIds,lowerIds,upperGroup,lowerGroup,remainingGroup,regionIds};
}

function buildLayerRanges(config) {
  const ranges=[];
  let upperCursor=config.tolerance, lowerCursor=-config.tolerance;
  let totalUpper=0,totalLower=0;
  config.thicknesses.forEach((pair,index) => {
    const upperLo=upperCursor, upperHi=upperCursor+pair.upper;
    ranges.push({id:config.upperIds[index],kind:"upper",lo:upperLo,hi:upperHi});
    upperCursor=upperHi;
    totalUpper+=pair.upper;
    const lowerHi=lowerCursor, lowerLo=lowerCursor-pair.lower;
    ranges.push({id:config.lowerIds[index],kind:"lower",lo:lowerLo,hi:lowerHi});
    lowerCursor=lowerLo;
    totalLower+=pair.lower;
  });
  return {ranges,totalUpper,totalLower,sMin:lowerCursor,sMax:upperCursor};
}

function verticalZAt(A,n,s,x,y) {
  if (Math.abs(n[2])<1e-10) return null;
  return A[2]+(s-n[0]*(x-A[0])-n[1]*(y-A[1]))/n[2];
}

const SVG_NS="http://www.w3.org/2000/svg";
function svgNode(name,attributes={},content="") {
  const node=document.createElementNS(SVG_NS,name);
  Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,String(value)));
  if (content!=="") node.textContent=content;
  return node;
}

function renderLayerDiagramError(message) {
  const svg=$("layerDiagram");
  svg.textContent="";
  svg.appendChild(svgNode("rect",{x:0,y:0,width:720,height:360,fill:"#fbfcfd"}));
  svg.appendChild(svgNode("text",{
    x:360,y:180,"text-anchor":"middle",fill:"#7a8993","font-size":14,
    "font-family":"Segoe UI, Microsoft YaHei UI, sans-serif"
  },message || "参数有效后自动绘制。"));
  svg.setAttribute("aria-label",message || "倾斜原子层截面图暂不可用");
  $("layerDiagramCaption").textContent=message || "参数有效后自动绘制。";
}

function renderLayerDiagram(geometry,config,rangeData,limit) {
  const {A,n,precision}=geometry;
  const projections={
    xy:{indices:[0,1],labels:["X","Y"]},
    xz:{indices:[0,2],labels:["X","Z"]},
    yz:{indices:[1,2],labels:["Y","Z"]}
  };
  let projectionKey=$("layerDiagramProjection").value;
  if (projectionKey==="auto") {
    projectionKey=Object.entries(projections)
      .map(([key,value])=>({key,score:Math.abs(
        limit.m[value.indices[0]]*n[value.indices[1]]-
        limit.m[value.indices[1]]*n[value.indices[0]]
      )}))
      .sort((left,right)=>right.score-left.score)[0].key;
  }
  const projection=projections[projectionKey];
  const [uIndex,vIndex]=projection.indices;
  const determinant=Math.abs(limit.m[uIndex]*n[vIndex]-limit.m[vIndex]*n[uIndex]);
  if (determinant<1e-7) {
    renderLayerDiagramError(`${projection.labels.join("–")} 投影中两组方向几乎重合，请改用自动投影或另一坐标面。`);
    return;
  }

  const normalSpan=Math.max(rangeData.sMax-rangeData.sMin,1);
  const q0=limit.enabled ? limit.q0 : 0;
  const qMin=Math.min(-1.5*normalSpan,q0-0.65*normalSpan);
  const qMax=Math.max(1.5*normalSpan,q0+0.65*normalSpan);
  const sPadding=Math.max(normalSpan*0.17,0.25);
  const sMin=rangeData.sMin-sPadding, sMax=rangeData.sMax+sPadding;
  const project=(q,s)=>[
    q*limit.m[uIndex]+s*n[uIndex],
    q*limit.m[vIndex]+s*n[vIndex]
  ];
  const fitPoints=[
    project(qMin,sMin),project(qMin,sMax),project(qMax,sMin),project(qMax,sMax)
  ];
  let uMin=Math.min(...fitPoints.map(point=>point[0]));
  let uMax=Math.max(...fitPoints.map(point=>point[0]));
  let vMin=Math.min(...fitPoints.map(point=>point[1]));
  let vMax=Math.max(...fitPoints.map(point=>point[1]));
  const uPadding=Math.max((uMax-uMin)*0.08,0.1);
  const vPadding=Math.max((vMax-vMin)*0.1,0.1);
  uMin-=uPadding; uMax+=uPadding; vMin-=vPadding; vMax+=vPadding;
  const frame={left:58,right:690,top:24,bottom:316};
  const toScreen=point=>[
    frame.left+(point[0]-uMin)/(uMax-uMin)*(frame.right-frame.left),
    frame.bottom-(point[1]-vMin)/(vMax-vMin)*(frame.bottom-frame.top)
  ];
  const screenPoint=(q,s)=>toScreen(project(q,s));
  const polygonPoints=(qLeft,qRight,sLo,sHi)=>[
    screenPoint(qLeft,sLo),screenPoint(qRight,sLo),
    screenPoint(qRight,sHi),screenPoint(qLeft,sHi)
  ].map(point=>point.map(value=>value.toFixed(2)).join(",")).join(" ");

  const svg=$("layerDiagram");
  svg.textContent="";
  svg.appendChild(svgNode("rect",{x:0,y:0,width:720,height:360,fill:"#fbfcfd"}));
  svg.appendChild(svgNode("rect",{
    x:frame.left,y:frame.top,width:frame.right-frame.left,height:frame.bottom-frame.top,
    rx:8,fill:"#ffffff",stroke:"#d7e0e6"
  }));

  const baseStart=screenPoint(qMin,0), baseEnd=screenPoint(qMax,0);
  svg.appendChild(svgNode("line",{
    x1:baseStart[0],y1:baseStart[1],x2:baseEnd[0],y2:baseEnd[1],
    stroke:"#7f909a","stroke-width":1.5,"stroke-dasharray":"7 6"
  }));

  rangeData.ranges.forEach(range => {
    const color=range.kind==="upper" ? "#1679a3" : "#087f7b";
    svg.appendChild(svgNode("polygon",{
      points:polygonPoints(qMin,qMax,range.lo,range.hi),
      fill:color,"fill-opacity":0.12,stroke:color,"stroke-opacity":0.45,"stroke-width":1.2
    }));
    let selectedMin=qMin,selectedMax=qMax;
    if (limit.enabled && limit.side==="greater") selectedMin=q0;
    if (limit.enabled && limit.side==="less") selectedMax=q0;
    svg.appendChild(svgNode("polygon",{
      points:polygonPoints(selectedMin,selectedMax,range.lo,range.hi),
      fill:color,"fill-opacity":0.76,stroke:color,"stroke-width":1.4
    }));
    if (config.count<=6 || range.id.endsWith("_1")) {
      const labelPoint=screenPoint((selectedMin+selectedMax)/2,(range.lo+range.hi)/2);
      svg.appendChild(svgNode("text",{
        x:labelPoint[0],y:labelPoint[1]+4,"text-anchor":"middle",fill:"#ffffff",
        "font-size":config.count<=3 ? 12 : 10,"font-weight":700,
        "font-family":"Segoe UI, Microsoft YaHei UI, sans-serif",
        stroke:color,"stroke-width":2.5,"paint-order":"stroke"
      },range.id));
    }
  });

  if (limit.enabled) {
    const limitStart=screenPoint(q0,sMin), limitEnd=screenPoint(q0,sMax);
    svg.appendChild(svgNode("line",{
      x1:limitStart[0],y1:limitStart[1],x2:limitEnd[0],y2:limitEnd[1],
      stroke:"#ee6c2c","stroke-width":3
    }));
    const direction=limit.side==="greater" ? 1 : -1;
    const arrowStart=screenPoint(q0,(sMin+sMax)/2);
    const arrowEnd=screenPoint(q0+direction*normalSpan*0.42,(sMin+sMax)/2);
    svg.appendChild(svgNode("line",{
      x1:arrowStart[0],y1:arrowStart[1],x2:arrowEnd[0],y2:arrowEnd[1],
      stroke:"#ee6c2c","stroke-width":2.5
    }));
    const dx=arrowEnd[0]-arrowStart[0],dy=arrowEnd[1]-arrowStart[1];
    const length=Math.hypot(dx,dy) || 1,ux=dx/length,uy=dy/length;
    const arrowPoints=[
      arrowEnd,
      [arrowEnd[0]-11*ux+5*uy,arrowEnd[1]-11*uy-5*ux],
      [arrowEnd[0]-11*ux-5*uy,arrowEnd[1]-11*uy+5*ux]
    ].map(point=>point.map(value=>value.toFixed(2)).join(",")).join(" ");
    svg.appendChild(svgNode("polygon",{points:arrowPoints,fill:"#ee6c2c"}));
    svg.appendChild(svgNode("text",{
      x:limitStart[0]+8,y:Math.max(frame.top+16,limitStart[1]-8),fill:"#b84816",
      "font-size":12,"font-weight":700,"font-family":"Segoe UI, Microsoft YaHei UI, sans-serif"
    },"裁剪界面"));
  }

  const centerLabel=screenPoint(qMin+(qMax-qMin)*0.04,0);
  svg.appendChild(svgNode("text",{
    x:centerLabel[0],y:centerLabel[1]-7,fill:"#667985","font-size":11,
    "font-family":"Segoe UI, Microsoft YaHei UI, sans-serif"
  },"s=0 中心面"));

  const axisOrigin=[76,298],axisLength=42;
  svg.appendChild(svgNode("line",{x1:axisOrigin[0],y1:axisOrigin[1],x2:axisOrigin[0]+axisLength,y2:axisOrigin[1],stroke:"#245d78","stroke-width":2}));
  svg.appendChild(svgNode("polygon",{points:`${axisOrigin[0]+axisLength},${axisOrigin[1]} ${axisOrigin[0]+axisLength-9},${axisOrigin[1]-4} ${axisOrigin[0]+axisLength-9},${axisOrigin[1]+4}`,fill:"#245d78"}));
  svg.appendChild(svgNode("line",{x1:axisOrigin[0],y1:axisOrigin[1],x2:axisOrigin[0],y2:axisOrigin[1]-axisLength,stroke:"#245d78","stroke-width":2}));
  svg.appendChild(svgNode("polygon",{points:`${axisOrigin[0]},${axisOrigin[1]-axisLength} ${axisOrigin[0]-4},${axisOrigin[1]-axisLength+9} ${axisOrigin[0]+4},${axisOrigin[1]-axisLength+9}`,fill:"#245d78"}));
  svg.appendChild(svgNode("text",{x:axisOrigin[0]+axisLength+7,y:axisOrigin[1]+4,fill:"#245d78","font-size":13,"font-weight":700},projection.labels[0]));
  svg.appendChild(svgNode("text",{x:axisOrigin[0]-4,y:axisOrigin[1]-axisLength-8,fill:"#245d78","font-size":13,"font-weight":700},projection.labels[1]));

  const condition=limit.enabled ? limit.condition : "未启用侧边界（显示完整薄层）";
  const caption=`${projection.labels.join("–")} 投影；蓝色为上层，绿色为下层，浅色轮廓为裁剪前范围。${limit.enabled ? `橙线为 m·X=${clean(limit.K,precision)}，箭头指向保留侧。` : ""} ${condition}；n=${vectorText(n,precision)}${limit.enabled ? `，m=${vectorText(limit.m,precision)}` : ""}。`;
  $("layerDiagramCaption").textContent=caption;
  svg.setAttribute("aria-label",`倾斜原子层动态截面图。${caption}`);
}

function renderLayerRows() {
  const saved=new Map();
  document.querySelectorAll("#layerRows .layer-row").forEach(row => {
    saved.set(Number(row.dataset.index), {
      upper:row.querySelector('[data-side="upper"]').value,
      lower:row.querySelector('[data-side="lower"]').value
    });
  });
  const container=$("layerRows");
  container.textContent="";
  const count=Number($("layerCount").value);
  if (!Number.isInteger(count) || count<1 || count>20) return;
  for (let i=1;i<=count;i++) {
    const values=saved.get(i) || {upper:"1",lower:"1"};
    const row=document.createElement("div");
    row.className="layer-row";
    row.dataset.index=i;
    row.innerHTML=`<span class="pair-index">${i}</span>
      <input id="upperThickness${i}" data-side="upper" type="number" min="0" step="any" value="${values.upper}" aria-label="第 ${i} 排上层厚度">
      <input id="lowerThickness${i}" data-side="lower" type="number" min="0" step="any" value="${values.lower}" aria-label="第 ${i} 排下层厚度">`;
    container.appendChild(row);
    row.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", syncLayerCalculations);
      input.addEventListener("change", syncLayerCalculations);
    });
  }
}

function calculateLayerCommands() {
  clearMessage("layerMessage");
  try {
    const geometry=getLayerGeometry();
    const {A,B,C,n,precision}=geometry;
    const config=getLayerConfiguration();
    const limit=getLayerLimit(geometry);
    if (limit.enabled && config.regionIds.includes(limit.id)) {
      throw new Error("侧边界区域名称与某一层的自动名称重复，请修改高级命名设置。");
    }
    const rangeData=buildLayerRanges(config);
    const regionLines=[], groupLines=[], intervalLines=[];
    const samplePoint=limit.enabled ? limit.S : A;

    if (limit.enabled) {
      regionLines.push(regionPlane(limit.id,limit.S,limit.m,limit.regionSide,"box",precision),"");
    }
    rangeData.ranges.forEach(range => {
      const loPoint=add(A,scale(n,range.lo)), hiPoint=add(A,scale(n,range.hi));
      const intersectIds=[`${range.id}_lo`,`${range.id}_hi`];
      if (limit.enabled) intersectIds.push(limit.id);
      regionLines.push(
        regionPlane(`${range.id}_lo`,loPoint,n,"in","box",precision),
        regionPlane(`${range.id}_hi`,hiPoint,n,"out","box",precision),
        `region ${range.id} intersect ${intersectIds.length} ${intersectIds.join(" ")}`
      );
      groupLines.push(`group ${range.id} region ${range.id}`);
      const zLo=verticalZAt(A,n,range.lo,samplePoint[0],samplePoint[1]);
      const zHi=verticalZAt(A,n,range.hi,samplePoint[0],samplePoint[1]);
      const zDescription=zLo===null
        ? "Z 无唯一有限区间（n_z≈0，该层沿 Z 方向延伸）"
        : `Z 边界：s=${clean(range.lo,precision)} 时 ${clean(zLo,precision)} Å，s=${clean(range.hi,precision)} 时 ${clean(zHi,precision)} Å；几何范围 ${clean(Math.min(zLo,zHi),precision)}–${clean(Math.max(zLo,zHi),precision)} Å`;
      intervalLines.push(`${range.id}: ${clean(range.lo,precision)} ≤ s < ${clean(range.hi,precision)} Å；${zDescription}`);
    });

    const D=-dot(n,A);
    $("layerNormalOut").textContent=vectorText(n,precision);
    $("layerEquationOut").textContent=`${clean(n[0],precision)}x + ${clean(n[1],precision)}y + ${clean(n[2],precision)}z + ${clean(D,precision)} = 0`;
    $("layerCountOut").textContent=`${config.count} 对（${config.count*2} 层）`;
    $("layerThicknessOut").textContent=`${clean(rangeData.totalUpper,precision)} / ${clean(rangeData.totalLower,precision)} Å`;
    $("layerLimitOut").textContent=limit.enabled
      ? `${limit.condition}；m=${vectorText(limit.m,precision)}`
      : "关闭（不裁剪）";
    $("layerVerticalSampleOut").textContent=`X=${clean(samplePoint[0],precision)}，Y=${clean(samplePoint[1],precision)}`;
    const limitExplanation=limit.enabled
      ? `橙色侧边界使用 ${limit.sourceName} 作为保留方向参考轴：m=${vectorText(limit.m,precision)}。它位于中心倾斜面内，因此橙色界面与中心面垂直（m·n=${clean(dot(limit.m,n),precision)}）。\n侧边界经过 S=${vectorText(limit.S,precision)}，投影位置 K=m·S=${clean(limit.K,precision)}；保留 ${limit.condition}（LAMMPS side ${limit.regionSide}）。`
      : "侧边界已关闭；每层只由上下两条厚度边界限定。";
    $("layerExplanation").textContent =
`中心面由 A=${vectorText(A,precision)}、B=${vectorText(B,precision)}、C=${vectorText(C,precision)} 确定。
定义法向距离 s=n·(X−A)，n=${vectorText(n,precision)} 指向上层。
${limitExplanation}
以下 Z 坐标均在固定取样位置 (X,Y)=(${clean(samplePoint[0],precision)}, ${clean(samplePoint[1],precision)}) 计算；倾斜层在其他 X、Y 处的 Z 会相应改变。
中心面两侧各排除 ${clean(config.tolerance,precision)} Å；以下半开区间从中心向外依次累计：
${intervalLines.join("\n")}
${config.tolerance===0 ? "LAMMPS 将边界归入 side in 而不归入 side out，因此中心面原子仅进入 upper_1，上下层不会重叠。" : `−${clean(config.tolerance,precision)} ≤ s < ${clean(config.tolerance,precision)} Å 的中心区间不属于 upper 或 lower。`}`;
    $("layerCode").textContent =
`${regionLines.join("\n")}

${groupLines.join("\n")}

group ${config.upperGroup} union ${config.upperIds.join(" ")}
group ${config.lowerGroup} union ${config.lowerIds.join(" ")}

group ${config.remainingGroup} subtract all ${config.upperGroup} ${config.lowerGroup}`;
    renderLayerDiagram(geometry,config,rangeData,limit);
  } catch(e) {
    $("layerCode").textContent="请修正输入参数后重新计算。";
    ["layerNormalOut","layerEquationOut","layerCountOut","layerThicknessOut","layerLimitOut","layerVerticalSampleOut"].forEach(id=>$(id).textContent="—");
    renderLayerDiagramError(e.message);
    showMessage("layerMessage",e.message);
  }
}

function calculateDisplacement() {
  clearMessage("displaceMessage");
  try {
    const {A,B,C,n,precision}=getLayerGeometry();
    const {upperGroup,lowerGroup}=getLayerGroupIds();
    const source=$("moveDirectionSource").value;
    let reference, sourceName;
    if (source==="ab") { reference=sub(B,A); sourceName="A→B"; }
    else if (source==="ac") { reference=sub(C,A); sourceName="A→C"; }
    else { reference=readPoint("mv"); sourceName="自定义向量 V"; }
    if (!validPoint(reference)) throw new Error("请完整输入自定义面内方向向量 V。");
    const projected=sub(reference,scale(n,dot(reference,n)));
    if (norm(projected)<EPS) throw new Error("所选方向与平面法向平行或长度过小，无法得到面内方向。");
    const tangent=normalized(projected);
    const paperDirection=normalized(cross(n,tangent));
    const alongDistance=Number($("alongMoveDistance").value);
    const paperDistance=Number($("paperMoveDistance").value);
    if (!Number.isFinite(alongDistance) || !Number.isFinite(paperDistance)) throw new Error("两个位移距离都必须是有效数值。");
    const upperMove=add(scale(tangent,alongDistance),scale(paperDirection,paperDistance));
    const lowerMove=scale(upperMove,-1);

    $("tangentOut").textContent=vectorText(tangent,precision);
    $("paperDirectionOut").textContent=vectorText(paperDirection,precision);
    $("upperMoveOut").textContent=vectorText(upperMove,precision);
    $("lowerMoveOut").textContent=vectorText(lowerMove,precision);
    $("displaceExplanation").textContent =
`${sourceName} 投影到中心倾斜面并归一化后，得到第一个面内方向 t=${vectorText(tangent,precision)}。
计算 p=n×t，得到同样位于倾斜面内、且与 t 垂直的横向方向 p=${vectorText(paperDirection,precision)}。
全部上层位移：Δ=${clean(alongDistance,precision)}t + ${clean(paperDistance,precision)}p = ${vectorText(upperMove,precision)} Å。
全部下层使用反向位移 −Δ=${vectorText(lowerMove,precision)} Å；位移总长度为 ${clean(norm(upperMove),precision)} Å。`;
    $("displaceCode").textContent =
`displace_atoms ${upperGroup} move ${upperMove.map(v=>clean(v,precision)).join(" ")} units box
displace_atoms ${lowerGroup} move ${lowerMove.map(v=>clean(v,precision)).join(" ")} units box`;
  } catch(e) {
    $("displaceCode").textContent="请修正输入参数后重新计算。";
    showMessage("displaceMessage",e.message);
  }
}

function syncLayerCalculations() {
  calculateLayerCommands();
  calculateDisplacement();
}

function updateLayerLimitControls() {
  const enabled=$("useLayerLimit").checked;
  $("layerLimitFields").classList.toggle("hidden",!enabled);
  $("customLayerLimitDirection").classList.toggle("hidden",$("layerLimitDirection").value!=="custom");
  const thresholdMode=$("layerLimitMode").value==="threshold";
  $("layerLimitPointFields").classList.toggle("hidden",thresholdMode);
  $("layerLimitThresholdField").classList.toggle("hidden",!thresholdMode);
}

$("layerCount").addEventListener("input", () => { renderLayerRows(); syncLayerCalculations(); });
$("layerCount").addEventListener("change", () => { renderLayerRows(); syncLayerCalculations(); });
$("useLayerLimit").addEventListener("change", () => { updateLayerLimitControls(); syncLayerCalculations(); });
$("layerLimitDirection").addEventListener("change", () => { updateLayerLimitControls(); syncLayerCalculations(); });
$("layerLimitMode").addEventListener("change", () => { updateLayerLimitControls(); syncLayerCalculations(); });
$("limitPointFromA").addEventListener("click", () => {
  ["x","y","z"].forEach(axis=>$("ls"+axis).value=$("la"+axis).value);
  syncLayerCalculations();
});
$("layerDiagramProjection").addEventListener("change",calculateLayerCommands);
$("moveDirectionSource").addEventListener("change", () => {
  $("customMoveDirection").classList.toggle("hidden", $("moveDirectionSource").value!=="custom");
  calculateDisplacement();
});
$("calcLayers").addEventListener("click", syncLayerCalculations);
$("calcDisplacement").addEventListener("click", calculateDisplacement);
$("layerExample").addEventListener("click", () => {
  const values={lax:0,lay:0,laz:0,lbx:10,lby:0,lbz:10,lcx:0,lcy:10,lcz:0};
  Object.entries(values).forEach(([id,value])=>$(id).value=value);
  $("layerNormalDirection").value="forward";
  $("layerCount").value=2;
  $("layerTolerance").value=0;
  $("upperPrefix").value="upper"; $("lowerPrefix").value="lower";
  $("upperUnionGroup").value="upper_atom"; $("lowerUnionGroup").value="lower_atom"; $("moveGroup").value="move_atom";
  renderLayerRows();
  $("upperThickness1").value=2; $("lowerThickness1").value=1;
  $("upperThickness2").value=1; $("lowerThickness2").value=1;
  $("useLayerLimit").checked=true;
  $("layerLimitDirection").value="ab";
  $("layerLimitSide").value="less";
  $("layerLimitMode").value="point";
  $("layerLimitId").value="layer_limit";
  $("lsx").value=5; $("lsy").value=0; $("lsz").value=5;
  updateLayerLimitControls();
  $("moveDirectionSource").value="ab";
  $("customMoveDirection").classList.add("hidden");
  $("alongMoveDistance").value=0.2768; $("paperMoveDistance").value=0;
  syncLayerCalculations();
});

function parsePastedPoints(areaId) {
  return $(areaId).value.split(/\r?\n/).map(line => {
    const matches=line.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
    return matches && matches.length>=3 ? matches.slice(0,3).map(Number) : null;
  }).filter(Boolean);
}
function assignPoint(prefix,p) { ["x","y","z"].forEach((axis,i)=>$(prefix+axis).value=p[i]); }
$("pastePlane").addEventListener("click", () => {
  clearMessage("planePasteMessage");
  const points=parsePastedPoints("planePasteArea");
  if (points.length<3) return showMessage("planePasteMessage","至少需要三行有效坐标，每行包含 X、Y、Z。");
  assignPoint("a",points[0]); assignPoint("b",points[1]); assignPoint("c",points[2]);
  $("pastePlane").closest("details").open=false;
  $("calcPlane").click();
});
$("pasteLayers").addEventListener("click", () => {
  clearMessage("layerPasteMessage");
  const points=parsePastedPoints("layerPasteArea");
  if (points.length<3) return showMessage("layerPasteMessage","至少需要三行有效坐标，每行包含 X、Y、Z。");
  assignPoint("la",points[0]); assignPoint("lb",points[1]); assignPoint("lc",points[2]);
  $("pasteLayers").closest("details").open=false;
  syncLayerCalculations();
});
$("pasteHexa").addEventListener("click", () => {
  clearMessage("hexaPasteMessage");
  const points=parsePastedPoints("hexaPasteArea");
  if (points.length<4) return showMessage("hexaPasteMessage","至少需要四行有效坐标，每行包含 X、Y、Z。");
  HEXA_BASE_PREFIXES.forEach((prefix,index)=>assignPoint(prefix,points[index]));
  $("pasteHexa").closest("details").open=false;
  calculateHexahedron();
});

document.querySelectorAll("[data-copy]").forEach(button => {
  button.addEventListener("click", async () => {
    const text=$(button.dataset.copy).textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      const old=button.textContent; button.textContent="已复制命令";
      setTimeout(()=>button.textContent=old,1200);
    } catch {
      const range=document.createRange(); range.selectNodeContents($(button.dataset.copy));
      const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      showMessage(button.dataset.message,"浏览器阻止自动复制，命令文本已选中，请按 Ctrl+C。","warn");
    }
  });
});

// Keep results synchronized with all editable inputs. This prevents stale
// commands from being copied after coordinates or the Region ID change.
[
  "planeMode","planeId","ax","ay","az","bx","by","bz","cx","cy","cz",
  "useInside","qx","qy","qz","planeSide","planePrecision","planeUnits","atomskInput","atomskOutput","atomskTolerance"
].forEach(id => {
  $(id).addEventListener("input", () => $("calcPlane").click());
  $(id).addEventListener("change", () => $("calcPlane").click());
});
[
  "hexaId","hax","hay","haz","hbx","hby","hbz",
  "hcx","hcy","hcz","hdx","hdy","hdz","hexaThickness","hexaExtrudeDirection",
  "hexaPrecision","hexaUnits","hexaTolerance","hexaAtomskTolerance",
  "hexaAtomskInput","hexaAtomskOutput"
].forEach(id => {
  $(id).addEventListener("input",calculateHexahedron);
  $(id).addEventListener("change",calculateHexahedron);
});
[
  "lax","lay","laz","lbx","lby","lbz","lcx","lcy","lcz",
  "layerNormalDirection","layerTolerance","upperPrefix","lowerPrefix",
  "upperUnionGroup","lowerUnionGroup","moveGroup","layerPrecision",
  "layerLimitSide","layerLimitId","lvx","lvy","lvz",
  "lsx","lsy","lsz","layerLimitK"
].forEach(id => {
  $(id).addEventListener("input", syncLayerCalculations);
  $(id).addEventListener("change", syncLayerCalculations);
});
["mvx","mvy","mvz","alongMoveDistance","paperMoveDistance"].forEach(id => {
  $(id).addEventListener("input", calculateDisplacement);
  $(id).addEventListener("change", calculateDisplacement);
});

$("calcPlane").click();
calculateHexahedron();
renderLayerRows();
updateLayerLimitControls();
syncLayerCalculations();

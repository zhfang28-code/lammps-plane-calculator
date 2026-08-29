const $ = id => document.getElementById(id);
const EPS = 1e-12;
const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = a => Math.hypot(...a);
const scale = (a,s) => a.map(v => v*s);
const normalized = a => scale(a, 1/norm(a));
const readPoint = prefix => {
  const tripletInput=$(prefix+"xyz");
  if (tripletInput) {
    try { return parseCoordinateTriplet(tripletInput.value,prefix.toUpperCase()).point; }
    catch { return [NaN,NaN,NaN]; }
  }
  return ["x","y","z"].map(axis => Number($(prefix+axis)?.value));
};
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

function setFormSectionCollapsed(section,collapsed) {
  const body=section.querySelector(":scope > .form-section-body");
  const toggle=section.querySelector(":scope > .section-heading > .form-section-toggle");
  if (!body || !toggle) return;
  section.classList.toggle("collapsed",collapsed);
  body.hidden=collapsed;
  toggle.setAttribute("aria-expanded",String(!collapsed));
  toggle.querySelector(".toggle-label").textContent=collapsed ? "展开" : "收起";
  toggle.querySelector(".collapse-symbol").textContent=collapsed ? "+" : "−";
}

function initializeCollapsibleFormSections() {
  document.querySelectorAll(".form-section").forEach(section => {
    const heading=section.querySelector(":scope > .section-heading");
    if (!heading || section.querySelector(":scope > .form-section-body")) return;
    const body=document.createElement("div");
    body.className="form-section-body";
    while (heading.nextSibling) body.appendChild(heading.nextSibling);
    section.appendChild(body);
    section.classList.add("collapsible-form-section");
    const toggle=document.createElement("button");
    toggle.type="button";
    toggle.className="form-section-toggle";
    toggle.innerHTML='<span class="toggle-label">收起</span><span class="collapse-symbol" aria-hidden="true">−</span>';
    toggle.setAttribute("aria-expanded","true");
    toggle.setAttribute("aria-controls",`${section.id}-body`);
    body.id=`${section.id}-body`;
    heading.appendChild(toggle);
    toggle.addEventListener("click",()=>setFormSectionCollapsed(section,!section.classList.contains("collapsed")));
  });
  document.querySelectorAll(".input-card").forEach(card => {
    const sections=[...card.querySelectorAll(":scope > .form-section")];
    sections.forEach((section,index)=>setFormSectionCollapsed(section,index>0));
  });
}

initializeCollapsibleFormSections();

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.tab).classList.add("active");
  });
});

document.querySelectorAll(".section-sidebar").forEach(sidebar => {
  const buttons=[...sidebar.querySelectorAll(".section-side-button")];
  const setActive=button => {
    buttons.forEach(item => {
      const active=item===button;
      item.classList.toggle("active",active);
      if (active) item.setAttribute("aria-current","step");
      else item.removeAttribute("aria-current");
    });
  };
  buttons.forEach(button => {
    const target=$(button.dataset.sectionTarget);
    if (!target) return;
    button.addEventListener("click", () => {
      setActive(button);
      if (target.classList.contains("collapsible-form-section")) setFormSectionCollapsed(target,false);
      if (target.tagName==="DETAILS") target.open=true;
      const behavior=window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      target.scrollIntoView({behavior,block:"start"});
      target.classList.remove("section-focus");
      void target.offsetWidth;
      target.classList.add("section-focus");
      window.setTimeout(()=>target.classList.remove("section-focus"),950);
    });
    target.addEventListener("focusin",()=>setActive(button));
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
  assignPoint("a",[0,100,50]);
  assignPoint("b",[0,200,250]);
  assignPoint("c",[1,0,0]);
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
  [[0,0,0],[0,10,0],[0,10,10],[0,0,10]].forEach((point,index)=>assignPoint(HEXA_BASE_PREFIXES[index],point));
  $("hexaThickness").value=12;
  $("hexaExtrudeDirection").value="positive";
  $("hexaId").value="hexa";
  calculateHexahedron();
});

function getMidplanePositioning(rawA,rawB,rawC,n,precision) {
  if (!$("useMidplanePosition").checked) {
    return {enabled:false,A:rawA,B:rawB,C:rawC};
  }
  const P1=parseCoordinateTriplet($("midplaneAtom1").value,"第一侧原子 P1").point;
  const P2=parseCoordinateTriplet($("midplaneAtom2").value,"第二侧原子 P2").point;
  if (norm(sub(P2,P1))<EPS) throw new Error("P1 与 P2 不能是同一个坐标，请选择界面两侧的两个不同原子。");
  if (Math.abs(n[2])<1e-8) throw new Error("当前倾斜面的 n_z≈0，平面在固定 X/Y 处没有唯一 Z，无法用双原子中点确定 Z 位置。");
  const midpoint=scale(add(P1,P2),0.5);
  const signedNormalShift=dot(n,sub(midpoint,rawA));
  const verticalShift=signedNormalShift/n[2];
  if (!Number.isFinite(verticalShift)) throw new Error("根据两个原子中点计算出的 Z 平移量无效，请检查输入坐标。");
  const shift=[0,0,verticalShift];
  const A=add(rawA,shift), B=add(rawB,shift), C=add(rawC,shift);
  const p1Distance=dot(n,sub(P1,A));
  const p2Distance=dot(n,sub(P2,A));
  const normalSpacing=Math.abs(dot(n,sub(P2,P1)));
  return {
    enabled:true,A,B,C,P1,P2,midpoint,verticalShift,signedNormalShift,
    p1Distance,p2Distance,normalSpacing,precision
  };
}

function getLayerGeometry() {
  const rawA=readPoint("la"), rawB=readPoint("lb"), rawC=readPoint("lc");
  if (![rawA,rawB,rawC].every(validPoint)) throw new Error("请完整输入倾斜面 A、B、C 的坐标。");
  let n=cross(sub(rawB,rawA),sub(rawC,rawA));
  if (norm(n)<EPS) throw new Error("倾斜面的三个点共线或过于接近，无法确定唯一平面。");
  n=normalized(n);
  if ($("layerNormalDirection").value==="reverse") n=scale(n,-1);
  const precision=Number($("layerPrecision").value);
  const positioning=getMidplanePositioning(rawA,rawB,rawC,n,precision);
  const {A,B,C}=positioning;
  return {A,B,C,n,precision,rawA,rawB,rawC,positioning};
}

const MIDPLANE_OUTPUT_IDS=[
  "midplanePointOut","midplaneTargetZOut","midplaneShiftOut",
  "midplaneSpacingOut","midplaneDistancesOut"
];

function updateMidplaneControls() {
  const enabled=$("useMidplanePosition").checked;
  $("midplaneFields").classList.toggle("hidden",!enabled);
  if (!enabled) {
    MIDPLANE_OUTPUT_IDS.forEach(id=>$(id).textContent="—");
    clearMessage("midplaneMessage");
  }
}

function renderMidplanePreview() {
  clearMessage("midplaneMessage");
  if (!$("useMidplanePosition").checked) {
    MIDPLANE_OUTPUT_IDS.forEach(id=>$(id).textContent="—");
    return;
  }
  try {
    const {positioning,precision}=getLayerGeometry();
    const {midpoint,verticalShift,signedNormalShift,normalSpacing,p1Distance,p2Distance}=positioning;
    $("midplanePointOut").textContent=vectorText(midpoint,precision);
    $("midplaneTargetZOut").textContent=`Z=${clean(midpoint[2],precision)} Å @ X=${clean(midpoint[0],precision)}, Y=${clean(midpoint[1],precision)}`;
    $("midplaneShiftOut").textContent=`ΔZ=${clean(verticalShift,precision)} Å；法向位移=${clean(signedNormalShift,precision)} Å`;
    $("midplaneSpacingOut").textContent=`${clean(normalSpacing,precision)} Å`;
    $("midplaneDistancesOut").textContent=`P1: ${clean(p1Distance,precision)} Å；P2: ${clean(p2Distance,precision)} Å`;
    if (normalSpacing<Math.max(Math.pow(10,-precision)*2,1e-6)) {
      showMessage("midplaneMessage","P1 与 P2 沿面法向的投影几乎重合；中点仍可定位平面，但这两个原子可能不是界面法向两侧的相邻原子。","warn");
    }
  } catch(error) {
    MIDPLANE_OUTPUT_IDS.forEach(id=>$(id).textContent="—");
    showMessage("midplaneMessage",error.message,"warn");
  }
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

const CALIBRATION_NUMBER_PATTERN=/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
let layerCalibrationItemCounter=0;
let layerCalibrationPointCounter=0;

function layerCalibrationItems() {
  return [...document.querySelectorAll("#layerCalibrationItems .calibration-item")];
}

function parseCoordinateTriplet(text,label="参考点") {
  const matches=text.match(CALIBRATION_NUMBER_PATTERN);
  if (!matches || matches.length<3) throw new Error(`请为 ${label} 粘贴三个 XYZ 数值。`);
  const point=matches.slice(0,3).map(Number);
  if (!validPoint(point)) throw new Error(`${label} 的坐标必须是有效数值。`);
  return {point,extraCount:Math.max(0,matches.length-3)};
}

function updateCalibrationCoordinateRecognition(input) {
  const entry=input.closest(".calibration-coordinate-entry");
  const output=entry?.querySelector(".coordinate-recognition");
  if (!output) return;
  const label=entry.querySelector(".coordinate-triplet-label")?.textContent.replace(/\s+/g," ").trim() || "该点";
  const text=input.value.trim();
  if (!text) {
    output.textContent="等待粘贴三个 XYZ 坐标";
    output.dataset.state="empty";
    return;
  }
  try {
    const {point,extraCount}=parseCoordinateTriplet(text,label);
    output.textContent=`已识别 XYZ = (${point.join(", ")})${extraCount ? `；另有 ${extraCount} 个数字未使用` : ""}`;
    output.dataset.state=extraCount ? "warning" : "valid";
  } catch(error) {
    output.textContent=error.message;
    output.dataset.state="invalid";
  }
}

function calibrationTargetOptions() {
  const count=Number($("layerCount").value);
  if (!Number.isInteger(count) || count<1 || count>20) return [];
  const upperPrefix=validId($("upperPrefix").value.trim()) ? $("upperPrefix").value.trim() : "upper";
  const lowerPrefix=validId($("lowerPrefix").value.trim()) ? $("lowerPrefix").value.trim() : "lower";
  const targets=[];
  for (let index=1;index<=count;index++) {
    targets.push(
      {value:`upper:${index}`,label:`${upperPrefix}_${index}（第 ${index} 排上层）`},
      {value:`lower:${index}`,label:`${lowerPrefix}_${index}（第 ${index} 排下层）`}
    );
  }
  return targets;
}

function updateCalibrationItemBrief(item,statusText) {
  if (statusText!==undefined) item.dataset.calibrationStatus=statusText;
  const select=item.querySelector(".calibration-target");
  const targetLabel=select?.selectedOptions[0]?.textContent.replace(/（.*$/," ").trim() || "未选择目标层";
  const insideCount=item.querySelectorAll('.calibration-coordinate-entry[data-point-role="inside"]').length;
  const outsideCount=item.querySelectorAll('.calibration-coordinate-entry[data-point-role="outside"]').length;
  const status=item.dataset.calibrationStatus || "等待坐标";
  item.querySelector(".calibration-item-brief").textContent=`${targetLabel} · 层内 ${insideCount} 点 / 层外 ${outsideCount} 点 · ${status}`;
}

function setLayerCalibrationItemCollapsed(item,collapsed) {
  item.classList.toggle("collapsed",collapsed);
  const button=item.querySelector(".calibration-toggle");
  button.textContent=collapsed ? "展开此组" : "收起此组";
  button.setAttribute("aria-expanded",String(!collapsed));
}

function updateLayerCalibrationTargets() {
  const items=layerCalibrationItems();
  const targets=calibrationTargetOptions();
  const claimed=new Set();
  items.forEach((item,itemIndex) => {
    const select=item.querySelector(".calibration-target");
    const current=select.value || item.dataset.preferredTarget || "";
    select.textContent="";
    let selected=targets.some(target=>target.value===current) && !claimed.has(current)
      ? current
      : targets.find(target=>!claimed.has(target.value))?.value || "";
    if (!selected) {
      const option=document.createElement("option");
      option.value="";
      option.textContent="没有尚未使用的目标层";
      select.appendChild(option);
    } else {
      targets.forEach(target => {
        const option=document.createElement("option");
        option.value=target.value;
        option.textContent=target.label;
        select.appendChild(option);
      });
      select.value=selected;
      claimed.add(selected);
    }
    item.dataset.preferredTarget="";
    item.querySelector(".calibration-group-number").textContent=String(itemIndex+1);
    updateCalibrationItemBrief(item);
  });
  const selectedValues=items.map(item=>item.querySelector(".calibration-target").value).filter(Boolean);
  items.forEach(item => {
    const own=item.querySelector(".calibration-target").value;
    item.querySelectorAll(".calibration-target option").forEach(option => {
      option.disabled=option.value!==own && selectedValues.includes(option.value);
    });
    item.querySelector(".calibration-remove").disabled=items.length===1;
  });
  const addButton=$("addLayerCalibration");
  addButton.disabled=!targets.length || selectedValues.length>=targets.length;
  addButton.title=addButton.disabled && targets.length ? "所有目标层都已添加校准组" : "";
}

function updateCalibrationPointLabels(item,role) {
  const entries=[...item.querySelectorAll(`.calibration-coordinate-entry[data-point-role="${role}"]`)];
  entries.forEach((entry,index) => {
    const pointLabel=role==="inside" ? "P_in" : "P_out";
    entry.querySelector(".calibration-point-label").textContent=`${pointLabel}${index+1}`;
    const input=entry.querySelector(".calibration-coordinate-input");
    input.setAttribute("aria-label",`${role==="inside" ? "层内" : "层外"}参考点 ${index+1} 的 XYZ 坐标`);
    entry.querySelector(".calibration-point-remove").disabled=entries.length===1;
  });
  updateCalibrationItemBrief(item);
}

function addCalibrationPoint(item,role,value="",shouldSync=true) {
  const list=item.querySelector(`.calibration-point-list[data-point-role="${role}"]`);
  const entry=document.createElement("div");
  const pointId=`calibrationPoint${++layerCalibrationPointCounter}`;
  entry.className="calibration-coordinate-entry";
  entry.dataset.pointRole=role;
  entry.innerHTML=`
    <div class="calibration-coordinate-row">
      <label class="calibration-point-label" for="${pointId}"></label>
      <input id="${pointId}" class="calibration-coordinate-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="例如：14.0199 261.154 125.018">
      <button class="secondary calibration-point-remove" type="button" aria-label="删除此参考点">删除</button>
    </div>
    <p class="coordinate-recognition" data-state="empty"></p>`;
  list.appendChild(entry);
  const input=entry.querySelector(".calibration-coordinate-input");
  input.value=value;
  updateCalibrationCoordinateRecognition(input);
  input.addEventListener("input",() => {
    updateCalibrationCoordinateRecognition(input);
    syncLayerCalculations();
  });
  input.addEventListener("change",syncLayerCalculations);
  entry.querySelector(".calibration-point-remove").addEventListener("click",() => {
    entry.remove();
    updateCalibrationPointLabels(item,role);
    syncLayerCalculations();
  });
  updateCalibrationPointLabels(item,role);
  if (shouldSync) syncLayerCalculations();
}

function createLayerCalibrationItem(preferredTarget="",shouldSync=true) {
  const item=document.createElement("section");
  const itemId=++layerCalibrationItemCounter;
  item.className="calibration-item";
  item.dataset.calibrationId=String(itemId);
  item.dataset.preferredTarget=preferredTarget;
  item.innerHTML=`
    <div class="calibration-item-header">
      <div class="calibration-item-title">
        <h4>校准组 <span class="calibration-group-number"></span></h4>
        <p class="calibration-item-brief">等待坐标</p>
      </div>
      <div class="calibration-header-actions">
        <button class="secondary calibration-toggle" type="button" aria-expanded="true" aria-controls="calibrationBody${itemId}">收起此组</button>
        <button class="secondary calibration-remove" type="button">删除此组</button>
      </div>
    </div>
    <div id="calibrationBody${itemId}" class="calibration-item-body">
    <div class="field">
      <label for="calibrationTarget${itemId}">要校准的目标层</label>
      <select id="calibrationTarget${itemId}" class="calibration-target"></select>
    </div>
    <div class="calibration-point-grid">
      <div class="calibration-point-card">
        <h4>必须在目标层内的原子</h4>
        <p class="help">全部层内点都必须被此目标层选中。</p>
        <div class="calibration-point-list" data-point-role="inside"></div>
        <button class="secondary add-calibration-point" data-point-role="inside" type="button">＋ 添加层内点</button>
      </div>
      <div class="calibration-point-card">
        <h4>必须在目标层外的原子</h4>
        <p class="help">全部层外点都必须被此目标层排除。</p>
        <div class="calibration-point-list" data-point-role="outside"></div>
        <button class="secondary add-calibration-point" data-point-role="outside" type="button">＋ 添加层外点</button>
      </div>
    </div>
    <details class="calibration-result-details">
      <summary class="calibration-result-summary">等待输入参考点</summary>
      <div class="message calibration-message warn" aria-live="polite"></div>
    </details>
    <div class="actions calibration-item-actions">
      <button class="secondary apply-calibration" type="button" disabled>优化此目标层厚度</button>
    </div>
    </div>`;
  $("layerCalibrationItems").appendChild(item);
  addCalibrationPoint(item,"inside","",false);
  addCalibrationPoint(item,"outside","",false);
  item.querySelector(".calibration-target").addEventListener("change",() => {
    updateLayerCalibrationTargets();
    syncLayerCalculations();
  });
  item.querySelector(".calibration-toggle").addEventListener("click",() => {
    setLayerCalibrationItemCollapsed(item,!item.classList.contains("collapsed"));
  });
  item.querySelector(".calibration-remove").addEventListener("click",() => {
    item.remove();
    updateLayerCalibrationTargets();
    syncLayerCalculations();
  });
  item.querySelectorAll(".add-calibration-point").forEach(button => {
    button.addEventListener("click",()=>addCalibrationPoint(item,button.dataset.pointRole));
  });
  item.querySelector(".apply-calibration").addEventListener("click",()=>applyLayerCalibrationRecommendation(item));
  updateLayerCalibrationTargets();
  if (shouldSync) syncLayerCalculations();
  return item;
}

function ensureLayerCalibrationItem() {
  if (!layerCalibrationItems().length) createLayerCalibrationItem("upper:1",false);
}

function updateLayerCalibrationControls() {
  const enabled=$("useLayerCalibration").checked;
  ensureLayerCalibrationItem();
  $("layerCalibrationFields").classList.toggle("hidden",!enabled);
  if (!enabled) {
    clearMessage("layerCalibrationGlobalMessage");
    layerCalibrationItems().forEach(item => {
      const message=item.querySelector(".calibration-message");
      message.className="message calibration-message warn";
      message.textContent="";
      const details=item.querySelector(".calibration-result-details");
      details.removeAttribute("open");
      details.dataset.state="waiting";
      item.querySelector(".calibration-result-summary").textContent="等待输入参考点";
      item.querySelector(".apply-calibration").disabled=true;
    });
    $("layerCalibrationOut").textContent="未启用";
    $("layerCalibrationOut").dataset.state="disabled";
    $("layerCalibrationOut").dataset.cause="";
  }
}

function layerLimitMembership(point,limit) {
  const projection=dot(limit.m,point);
  const passes=!limit.enabled || (limit.side==="greater" ? projection>=limit.K : projection<limit.K);
  return {passes,projection};
}

function readCalibrationPoints(item,role,label) {
  const inputs=[...item.querySelectorAll(`.calibration-coordinate-entry[data-point-role="${role}"] .calibration-coordinate-input`)];
  if (!inputs.length) throw new Error(`${label}至少需要一个参考点。`);
  return inputs.map((input,index)=>parseCoordinateTriplet(input.value,`${label} ${index+1}`).point);
}

function evaluateLayerCalibrationItem(item,geometry,config,rangeData,limit) {
  const targetValue=item.querySelector(".calibration-target").value;
  const match=/^(upper|lower):(\d+)$/.exec(targetValue);
  if (!match) throw new Error("请选择要校准的 upper 或 lower 目标层。");
  const kind=match[1], index=Number(match[2]);
  if (index<1 || index>config.count) throw new Error("所选目标层已不存在，请重新选择。");
  const targetId=(kind==="upper" ? config.upperIds : config.lowerIds)[index-1];
  const targetRange=rangeData.ranges.find(range=>range.id===targetId);
  if (!targetRange) throw new Error("无法找到所选目标层的法向范围。");

  const insidePoints=readCalibrationPoints(item,"inside","层内点 P_in");
  const outsidePoints=readCalibrationPoints(item,"outside","层外点 P_out");
  const signedDistance=point=>dot(geometry.n,sub(point,geometry.A));
  const inNormal=(s,range)=>s>=range.lo && s<range.hi;
  const selectedLayers=(s,limitResult)=>limitResult.passes
    ? rangeData.ranges.filter(range=>inNormal(s,range)).map(range=>range.id)
    : [];
  const direction=kind==="upper" ? 1 : -1;
  const innerD=kind==="upper" ? targetRange.lo : -targetRange.hi;
  const recordsFor=(points,role)=>points.map((point,index) => {
    const s=signedDistance(point);
    const limitResult=layerLimitMembership(point,limit);
    const layers=selectedLayers(s,limitResult);
    const d=direction*s;
    return {
      point,index,role,s,d,limit:limitResult,layers,
      selected:layers.includes(targetId),
      canReach:kind==="upper" ? d>=innerD-EPS : d>innerD+EPS,
      excludedByInner:kind==="upper" ? d<innerD-EPS : d<=innerD+EPS
    };
  });
  const insideRecords=recordsFor(insidePoints,"inside");
  const outsideRecords=recordsFor(outsidePoints,"outside");
  const currentPass=insideRecords.every(record=>record.selected) && outsideRecords.every(record=>!record.selected);
  const outputResolution=Math.pow(10,-geometry.precision);
  const boundaryMargin=Math.max(2*outputResolution,1e-6);
  let recommendation=null,reason="",reasonCode="";
  const lateralFailures=insideRecords.filter(record=>!record.limit.passes);
  const innerFailures=insideRecords.filter(record=>!record.canReach);
  const activeOutside=outsideRecords.filter(record=>record.limit.passes && !record.excludedByInner);
  const limitingInside=insideRecords.reduce((highest,record)=>record.d>highest.d ? record : highest);
  const limitingOutside=activeOutside.length
    ? activeOutside.reduce((lowest,record)=>record.d<lowest.d ? record : lowest)
    : null;

  if (lateralFailures.length) {
    reasonCode="inside-lateral";
    reason=`${lateralFailures.map(record=>`P_in${record.index+1}`).join("、")} 被当前横向裁剪界面排除；调整目标层厚度无法使这些点进入，请先修改横向裁剪的保留侧或界面位置。`;
  } else if (innerFailures.length) {
    reasonCode="inside-inner";
    reason=`${innerFailures.map(record=>`P_in${record.index+1}`).join("、")} 位于目标层内边界的中心侧；只修改本排外边界无法选中这些点。目标层内边界为 ${clean(innerD,geometry.precision)} Å（沿目标层向外方向）。`;
  } else if (!activeOutside.length) {
    if (insideRecords.every(record=>record.selected)) {
      reasonCode="already-satisfied";
      reason="当前约束已经满足：所有层外点均已由横向裁剪界面或目标层内边界排除，不需要修改目标层厚度。";
    } else {
      reasonCode="expand-to-inside";
      const boundaryD=limitingInside.d+boundaryMargin;
      recommendation={
        thickness:boundaryD-innerD,
        boundaryD,
        signedBoundary:direction*boundaryD,
        method:"最小可行外边界"
      };
      reason=`所有层外点已由其他边界排除；可把目标层外边界扩展到刚好越过最外侧层内点 P_in${limitingInside.index+1}。`;
    }
  } else if (limitingOutside.d<=limitingInside.d+EPS) {
    reasonCode="order-conflict";
    reason=`沿目标层向外方向，最近的层外点 P_out${limitingOutside.index+1}（${clean(limitingOutside.d,geometry.precision)} Å）不比最外侧层内点 P_in${limitingInside.index+1}（${clean(limitingInside.d,geometry.precision)} Å）更远；一条平行外边界无法同时满足全部点。`;
  } else if (limitingOutside.d-limitingInside.d<=2*outputResolution) {
    reasonCode="precision-conflict";
    reason=`限制边界的 P_in${limitingInside.index+1} 与 P_out${limitingOutside.index+1} 法向距离差小于当前 ${geometry.precision} 位小数可稳定分辨的范围；请提高“输出小数位”后再优化。`;
  } else {
    reasonCode="midpoint";
    const boundaryD=(limitingInside.d+limitingOutside.d)/2;
    recommendation={
      thickness:boundaryD-innerD,
      boundaryD,
      signedBoundary:direction*boundaryD,
      method:"两点法向投影中点"
    };
    reason=`全部点可由一条平行外边界分开；边界由最外侧层内点 P_in${limitingInside.index+1} 与最近层外点 P_out${limitingOutside.index+1} 的法向投影中点确定。`;
  }

  const actualLayerText=layers=>layers.length ? layers.join("、") : "未进入任何已生成层";
  const targetInterval=`${clean(targetRange.lo,geometry.precision)} ≤ s < ${clean(targetRange.hi,geometry.precision)} Å`;
  const status=currentPass ? "pass" : recommendation ? "adjustable" : "conflict";
  const summary=currentPass
    ? `通过：${insideRecords.length} 个层内点均在 ${targetId}，${outsideRecords.length} 个层外点均不在 ${targetId}`
    : recommendation
      ? `可优化：调整 ${targetId} 的厚度后可满足全部 ${insideRecords.length+outsideRecords.length} 个参考点`
      : `约束未满足：当前无法仅靠 ${targetId} 的外边界解决`;
  const recommendationText=recommendation
    ? `建议外边界：s=${clean(recommendation.signedBoundary,geometry.precision)} Å；建议 ${targetId} 厚度=${clean(recommendation.thickness,geometry.precision)} Å（${recommendation.method}）。`
    : "未生成厚度调整值。";
  const recordText=record=>`${record.role==="inside" ? "P_in" : "P_out"}${record.index+1}=${vectorText(record.point,geometry.precision)}：s=${clean(record.s,geometry.precision)} Å，横向裁剪${record.limit.passes ? "通过" : "不通过"}；当前归属：${actualLayerText(record.layers)}。`;
  const explanation=
`参考原子校准目标：${targetId}，当前法向范围 ${targetInterval}。
${[...insideRecords,...outsideRecords].map(recordText).join("\n")}
${reason}
${recommendationText}`;

  return {
    enabled:true,item,status,summary,explanation,reason,reasonCode,recommendation,
    targetId,targetRange,kind,index,insideRecords,outsideRecords,currentPass
  };
}

function evaluateLayerCalibrations(geometry,config,rangeData,limit) {
  if (!$("useLayerCalibration").checked) return [];
  return layerCalibrationItems().map(item => {
    try {
      return evaluateLayerCalibrationItem(item,geometry,config,rangeData,limit);
    } catch(error) {
      return {enabled:true,item,status:"input-error",error:error.message};
    }
  });
}

function showCalibrationItemMessage(item,text,type="warn",summary="查看校准详情") {
  const details=item.querySelector(".calibration-result-details");
  details.dataset.state=type;
  item.querySelector(".calibration-result-summary").textContent=summary;
  const message=item.querySelector(".calibration-message");
  message.textContent=text;
  message.className=`message calibration-message show ${type}`;
}

function renderLayerCalibrations(calibrations) {
  clearMessage("layerCalibrationGlobalMessage");
  if (!$("useLayerCalibration").checked) {
    $("layerCalibrationOut").textContent="未启用";
    $("layerCalibrationOut").dataset.state="disabled";
    $("layerCalibrationOut").dataset.cause="";
    return;
  }
  calibrations.forEach(calibration => {
    const button=calibration.item.querySelector(".apply-calibration");
    button.disabled=true;
    if (calibration.error) {
      updateCalibrationItemBrief(calibration.item,"等待坐标");
      showCalibrationItemMessage(calibration.item,calibration.error,"warn","等待完整参考点（展开查看）");
      return;
    }
    const briefStatus=calibration.status==="pass" ? "通过" : calibration.status==="adjustable" ? "可优化" : "冲突";
    updateCalibrationItemBrief(calibration.item,briefStatus);
    const messageType=calibration.status==="pass" ? "ok" : calibration.status==="adjustable" ? "warn" : "error";
    showCalibrationItemMessage(calibration.item,calibration.explanation,messageType,`${calibration.summary}（展开查看）`);
    button.disabled=!calibration.recommendation;
  });
  const counts={pass:0,adjustable:0,conflict:0,"input-error":0};
  calibrations.forEach(calibration=>counts[calibration.status]++);
  const parts=[];
  if (counts.pass) parts.push(`${counts.pass} 组通过`);
  if (counts.adjustable) parts.push(`${counts.adjustable} 组可优化`);
  if (counts.conflict) parts.push(`${counts.conflict} 组冲突`);
  if (counts["input-error"]) parts.push(`${counts["input-error"]} 组等待坐标`);
  $("layerCalibrationOut").textContent=parts.length ? parts.join("，") : "尚未添加校准组";
  const state=counts.conflict ? "conflict" : counts.adjustable ? "adjustable" : counts["input-error"] ? "input-error" : "pass";
  $("layerCalibrationOut").dataset.state=state;
  $("layerCalibrationOut").dataset.cause=state;
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

function renderLayerDiagram(geometry,config,rangeData,limit,calibrations=[]) {
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
  const midpointGuide=geometry.positioning.enabled ? {
    P1:geometry.positioning.P1,
    P2:geometry.positioning.P2,
    midpoint:geometry.positioning.midpoint,
    p1Distance:geometry.positioning.p1Distance,
    p2Distance:geometry.positioning.p2Distance
  } : null;
  const midpointGuidePoints=midpointGuide ? [
    {label:"P1",point:midpointGuide.P1,s:midpointGuide.p1Distance},
    {label:"P2",point:midpointGuide.P2,s:midpointGuide.p2Distance},
    {label:"M",point:midpointGuide.midpoint,s:0}
  ].map(item=>({...item,q:dot(limit.m,sub(item.point,A))})) : [];
  let qMin=Math.min(-1.5*normalSpan,q0-0.65*normalSpan);
  let qMax=Math.max(1.5*normalSpan,q0+0.65*normalSpan);
  if (midpointGuidePoints.length) {
    const guidePadding=Math.max(normalSpan*0.14,0.2);
    qMin=Math.min(qMin,...midpointGuidePoints.map(item=>item.q))-guidePadding;
    qMax=Math.max(qMax,...midpointGuidePoints.map(item=>item.q))+guidePadding;
  }
  const sPadding=Math.max(normalSpan*0.17,0.25);
  let sMin=rangeData.sMin-sPadding, sMax=rangeData.sMax+sPadding;
  if (midpointGuidePoints.length) {
    sMin=Math.min(sMin,...midpointGuidePoints.map(item=>item.s))-sPadding*0.3;
    sMax=Math.max(sMax,...midpointGuidePoints.map(item=>item.s))+sPadding*0.3;
  }
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

  if (midpointGuidePoints.length) {
    const P1=midpointGuidePoints.find(item=>item.label==="P1");
    const P2=midpointGuidePoints.find(item=>item.label==="P2");
    const M=midpointGuidePoints.find(item=>item.label==="M");
    const p1Screen=screenPoint(P1.q,P1.s),p2Screen=screenPoint(P2.q,P2.s),midScreen=screenPoint(M.q,M.s);
    svg.appendChild(svgNode("line",{
      x1:p1Screen[0],y1:p1Screen[1],x2:p2Screen[0],y2:p2Screen[1],
      stroke:"#76518f","stroke-width":2,"stroke-dasharray":"5 4"
    }));
    [
      {item:P1,position:p1Screen,label:"P1"},
      {item:P2,position:p2Screen,label:"P2"}
    ].forEach(marker=>{
      svg.appendChild(svgNode("circle",{
        cx:marker.position[0],cy:marker.position[1],r:6,fill:"#ffffff",stroke:"#76518f","stroke-width":3
      }));
      svg.appendChild(svgNode("text",{
        x:marker.position[0]+9,y:marker.position[1]-8,fill:"#65417e","font-size":11,"font-weight":800,
        "font-family":"Segoe UI, Microsoft YaHei UI, sans-serif",stroke:"#ffffff","stroke-width":3,"paint-order":"stroke"
      },marker.label));
    });
    const diamondPoints=[
      [midScreen[0],midScreen[1]-7],[midScreen[0]+7,midScreen[1]],
      [midScreen[0],midScreen[1]+7],[midScreen[0]-7,midScreen[1]]
    ].map(point=>point.map(value=>value.toFixed(2)).join(",")).join(" ");
    svg.appendChild(svgNode("polygon",{
      points:diamondPoints,fill:"#f18a3b",stroke:"#ffffff","stroke-width":2
    }));
    svg.appendChild(svgNode("text",{
      x:midScreen[0]+10,y:midScreen[1]+16,fill:"#b95618","font-size":11,"font-weight":800,
      "font-family":"Segoe UI, Microsoft YaHei UI, sans-serif",stroke:"#ffffff","stroke-width":3,"paint-order":"stroke"
    },"中点 M"));
  }

  let calibrationMarkerCount=0;
  const calibrationMarkers=calibrations
    .filter(calibration=>!calibration.error)
    .flatMap(calibration=>[
      ...calibration.insideRecords.map(record=>({
        point:record.point,s:record.s,label:`${calibration.targetId} P_in${record.index+1}`,satisfied:record.selected
      })),
      ...calibration.outsideRecords.map(record=>({
        point:record.point,s:record.s,label:`${calibration.targetId} P_out${record.index+1}`,satisfied:!record.selected
      }))
    ]);
  calibrationMarkers.forEach(marker => {
      const q=dot(limit.m,sub(marker.point,A));
      const position=screenPoint(q,marker.s);
      const visible=position[0]>=frame.left && position[0]<=frame.right && position[1]>=frame.top && position[1]<=frame.bottom;
      if (!visible) return;
      calibrationMarkerCount++;
      const color=marker.satisfied ? "#2f8f5b" : "#c94c46";
      svg.appendChild(svgNode("circle",{
        cx:position[0],cy:position[1],r:7,fill:"#ffffff",stroke:color,"stroke-width":3
      }));
      svg.appendChild(svgNode("text",{
        x:position[0]+10,y:position[1]-9,fill:color,"font-size":11,"font-weight":800,
        "font-family":"Segoe UI, Microsoft YaHei UI, sans-serif",
        stroke:"#ffffff","stroke-width":3,"paint-order":"stroke"
      },`${marker.label} ${marker.satisfied ? "✓" : "×"}`));
  });

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
  const hiddenMarkerCount=calibrationMarkers.length-calibrationMarkerCount;
  const calibrationCaption=calibrationMarkers.length
    ? calibrationMarkerCount===calibrationMarkers.length
      ? `${calibrationMarkerCount} 个参考点均已标记；绿色表示满足目标约束，红色表示不满足。`
      : calibrationMarkerCount
        ? `${calibrationMarkerCount} 个参考点可见，另有 ${hiddenMarkerCount} 个超出截面范围；绿色表示满足约束，红色表示不满足。`
        : `${calibrationMarkers.length} 个参考点均位于当前截面预览范围外，请查看各校准组的文字结果。`
    : "";
  const midpointCaption=midpointGuidePoints.length ? "紫色圆点为定位原子 P1、P2，橙色菱形为两者中点 M。" : "";
  const caption=`${projection.labels.join("–")} 投影；蓝色为上层，绿色为下层，浅色轮廓为裁剪前范围。${limit.enabled ? `橙线为 m·X=${clean(limit.K,precision)}，箭头指向保留侧。` : ""} ${midpointCaption} ${calibrationCaption} ${condition}；n=${vectorText(n,precision)}${limit.enabled ? `，m=${vectorText(limit.m,precision)}` : ""}。`;
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
  updateLayerCalibrationTargets();
}

function calculateLayerCommands() {
  clearMessage("layerMessage");
  try {
    const geometry=getLayerGeometry();
    const {A,B,C,n,precision,rawA,rawB,rawC,positioning}=geometry;
    const config=getLayerConfiguration();
    const limit=getLayerLimit(geometry);
    if (limit.enabled && config.regionIds.includes(limit.id)) {
      throw new Error("侧边界区域名称与某一层的自动名称重复，请修改高级命名设置。");
    }
    const rangeData=buildLayerRanges(config);
    const calibrations=evaluateLayerCalibrations(geometry,config,rangeData,limit);
    renderLayerCalibrations(calibrations);
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
    $("layerPositionModeOut").textContent=positioning.enabled
      ? `双原子中点 M 定位；ΔZ=${clean(positioning.verticalShift,precision)} Å`
      : "由 A、B、C 直接确定";
    const limitExplanation=limit.enabled
      ? `橙色侧边界使用 ${limit.sourceName} 作为保留方向参考轴：m=${vectorText(limit.m,precision)}。它位于中心倾斜面内，因此橙色界面与中心面垂直（m·n=${clean(dot(limit.m,n),precision)}）。\n侧边界经过 S=${vectorText(limit.S,precision)}，投影位置 K=m·S=${clean(limit.K,precision)}；保留 ${limit.condition}（LAMMPS side ${limit.regionSide}）。`
      : "侧边界已关闭；每层只由上下两条厚度边界限定。";
    const calibrationExplanation=!$("useLayerCalibration").checked
      ? "参考原子校准未启用。"
      : calibrations.map((calibration,index)=>calibration.error
        ? `[校准组 ${index+1}] 尚未完成：${calibration.error}`
        : `[校准组 ${index+1}]\n${calibration.explanation}`
      ).join("\n\n");
    const positionExplanation=positioning.enabled
      ? `基础点 A₀=${vectorText(rawA,precision)}、B₀=${vectorText(rawB,precision)}、C₀=${vectorText(rawC,precision)} 确定倾斜方向。
P1=${vectorText(positioning.P1,precision)}、P2=${vectorText(positioning.P2,precision)} 的三维中点 M=${vectorText(positioning.midpoint,precision)} 用于定位中心面。
保持法向不变，将基础平面沿 Z 平移 ΔZ=${clean(positioning.verticalShift,precision)} Å（等效法向位移 ${clean(positioning.signedNormalShift,precision)} Å）；定位后的参考点 A=${vectorText(A,precision)}。`
      : `中心面由 A=${vectorText(A,precision)}、B=${vectorText(B,precision)}、C=${vectorText(C,precision)} 直接确定。`;
    $("layerExplanation").textContent =
`${positionExplanation}
定义法向距离 s=n·(X−A)，n=${vectorText(n,precision)} 指向上层。
${limitExplanation}
${calibrationExplanation}
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
    renderLayerDiagram(geometry,config,rangeData,limit,calibrations);
  } catch(e) {
    $("layerCode").textContent="请修正输入参数后重新计算。";
    ["layerNormalOut","layerEquationOut","layerCountOut","layerThicknessOut","layerLimitOut","layerVerticalSampleOut","layerPositionModeOut"].forEach(id=>$(id).textContent="—");
    $("layerCalibrationOut").textContent=$("useLayerCalibration").checked ? "等待有效的原子层参数" : "未启用";
    $("layerCalibrationOut").dataset.state=$("useLayerCalibration").checked ? "waiting" : "disabled";
    $("layerCalibrationOut").dataset.cause=$("useLayerCalibration").checked ? "layer-error" : "";
    layerCalibrationItems().forEach(item=>{
      item.querySelector(".apply-calibration").disabled=true;
      updateCalibrationItemBrief(item,"等待有效参数");
    });
    if ($("useLayerCalibration").checked) showMessage("layerCalibrationGlobalMessage",e.message,"warn");
    renderLayerDiagramError(e.message);
    showMessage("layerMessage",e.message);
  }
}

function updateDisplacementControls() {
  const planeMode=$("displacementInputMode").value==="plane";
  const source=$("moveDirectionSource").value;
  $("planeDisplacementFields").classList.toggle("hidden",!planeMode);
  $("xyzDisplacementFields").classList.toggle("hidden",planeMode);
  $("twoPointMoveDirection").classList.toggle("hidden",!planeMode || source!=="points");
  $("customMoveDirection").classList.toggle("hidden",!planeMode || source!=="custom");
  $("tangentMetric").classList.toggle("hidden",!planeMode);
  $("paperDirectionMetric").classList.toggle("hidden",!planeMode);
}

function calculateDisplacement() {
  clearMessage("displaceMessage");
  try {
    const inputMode=$("displacementInputMode").value;
    const precision=Number($("layerPrecision").value);
    const {upperGroup,lowerGroup}=getLayerGroupIds();
    let relativeMove,directionExplanation;

    if (inputMode==="plane") {
      const {A,B,C,n}=getLayerGeometry();
      const source=$("moveDirectionSource").value;
      let reference,sourceName;
      if (source==="ab") {
        reference=sub(B,A);
        sourceName="A→B";
      } else if (source==="ac") {
        reference=sub(C,A);
        sourceName="A→C";
      } else if (source==="points") {
        const P=parseCoordinateTriplet($("moveDirectionPoint1").value,"方向起点 P").point;
        const Q=parseCoordinateTriplet($("moveDirectionPoint2").value,"方向终点 Q").point;
        reference=sub(Q,P);
        if (norm(reference)<EPS) throw new Error("方向起点 P 与终点 Q 不能是同一个坐标。");
        sourceName=`两点 P=${vectorText(P,precision)} → Q=${vectorText(Q,precision)} 的方向`;
      } else {
        reference=readPoint("mv");
        sourceName="自定义向量 V";
      }
      if (!validPoint(reference)) throw new Error("请完整输入第一个面内方向。");
      const projected=sub(reference,scale(n,dot(reference,n)));
      if (norm(projected)<EPS) throw new Error("所选方向与平面法向平行或长度过小，无法得到面内方向。");
      const tangent=normalized(projected);
      const paperDirection=normalized(cross(n,tangent));
      const alongDistance=Number($("alongMoveDistance").value);
      const paperDistance=Number($("paperMoveDistance").value);
      if (!Number.isFinite(alongDistance) || !Number.isFinite(paperDistance)) throw new Error("两个总相对位移分量都必须是有效数值。");
      relativeMove=add(scale(tangent,alongDistance),scale(paperDirection,paperDistance));
      $("tangentOut").textContent=vectorText(tangent,precision);
      $("paperDirectionOut").textContent=vectorText(paperDirection,precision);
      directionExplanation=
`${sourceName} 投影到中心倾斜面并归一化后，得到第一个面内方向 t=${vectorText(tangent,precision)}。
计算 p=n×t，得到同样位于倾斜面内、且与 t 垂直的第二方向 p=${vectorText(paperDirection,precision)}。
输入的总相对位移：Δrel=${clean(alongDistance,precision)}t + ${clean(paperDistance,precision)}p = ${vectorText(relativeMove,precision)} Å。`;
    } else {
      const directInputs=["directMoveX","directMoveY","directMoveZ"].map(id=>$(id));
      if (directInputs.some(input=>input.value.trim()==="")) throw new Error("请完整填写标准坐标系下的 ΔX、ΔY、ΔZ。");
      relativeMove=directInputs.map(input=>Number(input.value));
      if (!validPoint(relativeMove)) throw new Error("ΔX、ΔY、ΔZ 都必须是有效数值。");
      $("tangentOut").textContent="—";
      $("paperDirectionOut").textContent="—";
      let componentExplanation="";
      try {
        const {n}=getLayerGeometry();
        const normalComponent=dot(relativeMove,n);
        const inPlaneComponent=sub(relativeMove,scale(n,normalComponent));
        componentExplanation=` 相对于当前倾斜面，其法向有符号分量为 ${clean(normalComponent,precision)} Å，面内分量为 ${vectorText(inPlaneComponent,precision)} Å。`;
      } catch {
        componentExplanation=" 当前倾斜面参数无效，因此未附加面内/法向分解；XYZ 位移命令仍按输入值生成。";
      }
      directionExplanation=`直接使用标准坐标系输入 Δrel=(ΔX, ΔY, ΔZ)=${vectorText(relativeMove,precision)} Å，不进行面内投影。${componentExplanation}`;
    }

    const upperMove=scale(relativeMove,0.5);
    const lowerMove=scale(relativeMove,-0.5);
    $("relativeMoveOut").textContent=vectorText(relativeMove,precision);
    $("upperMoveOut").textContent=vectorText(upperMove,precision);
    $("lowerMoveOut").textContent=vectorText(lowerMove,precision);
    $("displaceExplanation").textContent =
`${directionExplanation}
对称拆分后，全部上层位移 Δupper=+Δrel/2=${vectorText(upperMove,precision)} Å，全部下层位移 Δlower=−Δrel/2=${vectorText(lowerMove,precision)} Å。
校验：Δupper−Δlower=Δrel；两层的相对位移总长度为 ${clean(norm(relativeMove),precision)} Å。`;
    $("displaceCode").textContent =
`displace_atoms ${upperGroup} move ${upperMove.map(v=>clean(v,precision)).join(" ")} units box
displace_atoms ${lowerGroup} move ${lowerMove.map(v=>clean(v,precision)).join(" ")} units box`;
  } catch(e) {
    ["tangentOut","paperDirectionOut","relativeMoveOut","upperMoveOut","lowerMoveOut"].forEach(id => $(id).textContent="—");
    $("displaceExplanation").textContent="请修正输入参数后重新计算。";
    $("displaceCode").textContent="请修正输入参数后重新计算。";
    showMessage("displaceMessage",e.message);
  }
}

function syncLayerCalculations() {
  renderMidplanePreview();
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

function applyLayerCalibrationRecommendation(item) {
  clearMessage("layerMessage");
  try {
    const geometry=getLayerGeometry();
    const config=getLayerConfiguration();
    const limit=getLayerLimit(geometry);
    const rangeData=buildLayerRanges(config);
    const calibration=evaluateLayerCalibrationItem(item,geometry,config,rangeData,limit);
    if (!calibration.recommendation) throw new Error("当前两点没有可应用的目标层厚度，请先根据校准提示调整点或其他边界参数。");
    const inputId=`${calibration.kind}Thickness${calibration.index}`;
    const input=$(inputId);
    if (!input) throw new Error("无法找到目标层对应的厚度输入框。");
    input.value=clean(calibration.recommendation.thickness,geometry.precision);
    syncLayerCalculations();
  } catch(error) {
    showCalibrationItemMessage(item,error.message,"error","无法应用厚度建议（展开查看）");
    item.querySelector(".apply-calibration").disabled=true;
  }
}

$("layerCount").addEventListener("input", () => { renderLayerRows(); syncLayerCalculations(); });
$("layerCount").addEventListener("change", () => { renderLayerRows(); syncLayerCalculations(); });
$("useLayerLimit").addEventListener("change", () => { updateLayerLimitControls(); syncLayerCalculations(); });
$("layerLimitDirection").addEventListener("change", () => { updateLayerLimitControls(); syncLayerCalculations(); });
$("layerLimitMode").addEventListener("change", () => { updateLayerLimitControls(); syncLayerCalculations(); });
$("limitPointFromA").addEventListener("click", () => {
  clearMessage("layerMessage");
  try {
    const {A}=getLayerGeometry();
    assignPoint("ls",A);
    syncLayerCalculations();
  } catch(error) {
    showMessage("layerMessage",error.message);
  }
});
$("useMidplanePosition").addEventListener("change", () => { updateMidplaneControls(); syncLayerCalculations(); });
["midplaneAtom1","midplaneAtom2"].forEach(id => {
  const input=$(id);
  input.addEventListener("input",() => {
    updateCalibrationCoordinateRecognition(input);
    syncLayerCalculations();
  });
  input.addEventListener("change",syncLayerCalculations);
});
$("useLayerCalibration").addEventListener("change", () => { updateLayerCalibrationControls(); syncLayerCalculations(); });
$("addLayerCalibration").addEventListener("click",()=>createLayerCalibrationItem());
["upperPrefix","lowerPrefix"].forEach(id => {
  $(id).addEventListener("input",updateLayerCalibrationTargets);
  $(id).addEventListener("change",updateLayerCalibrationTargets);
});
$("layerDiagramProjection").addEventListener("change",calculateLayerCommands);
$("displacementInputMode").addEventListener("change", () => {
  updateDisplacementControls();
  calculateDisplacement();
});
$("moveDirectionSource").addEventListener("change", () => {
  updateDisplacementControls();
  calculateDisplacement();
});
["moveDirectionPoint1","moveDirectionPoint2"].forEach(id=>{
  const input=$(id);
  input.addEventListener("input",()=>{
    updateCalibrationCoordinateRecognition(input);
    calculateDisplacement();
  });
  input.addEventListener("change",calculateDisplacement);
});
$("calcLayers").addEventListener("click", syncLayerCalculations);
$("calcDisplacement").addEventListener("click", calculateDisplacement);
$("layerExample").addEventListener("click", () => {
  assignPoint("la",[0,0,0]);
  assignPoint("lb",[10,0,10]);
  assignPoint("lc",[0,10,0]);
  $("layerNormalDirection").value="forward";
  $("useMidplanePosition").checked=false;
  ["midplaneAtom1","midplaneAtom2"].forEach(id=>{
    $(id).value="";
    updateCalibrationCoordinateRecognition($(id));
  });
  updateMidplaneControls();
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
  assignPoint("ls",[5,0,5]);
  updateLayerLimitControls();
  $("useLayerCalibration").checked=false;
  updateLayerCalibrationControls();
  $("displacementInputMode").value="plane";
  $("moveDirectionSource").value="ab";
  ["moveDirectionPoint1","moveDirectionPoint2"].forEach(id=>{
    $(id).value="";
    updateCalibrationCoordinateRecognition($(id));
  });
  $("alongMoveDistance").value=0.5536; $("paperMoveDistance").value=0;
  $("directMoveX").value=0.5536; $("directMoveY").value=0; $("directMoveZ").value=0;
  updateDisplacementControls();
  syncLayerCalculations();
});

function parsePastedPoints(areaId) {
  return $(areaId).value.split(/\r?\n/).map(line => {
    const matches=line.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
    return matches && matches.length>=3 ? matches.slice(0,3).map(Number) : null;
  }).filter(Boolean);
}
function assignPoint(prefix,p) {
  const tripletInput=$(prefix+"xyz");
  if (tripletInput) {
    tripletInput.value=p.join(" ");
    updateCalibrationCoordinateRecognition(tripletInput);
    return;
  }
  ["x","y","z"].forEach((axis,i)=>$(prefix+axis).value=p[i]);
}
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
  "planeMode","planeId","axyz","bxyz","cxyz",
  "useInside","qxyz","planeSide","planePrecision","planeUnits","atomskInput","atomskOutput","atomskTolerance"
].forEach(id => {
  $(id).addEventListener("input", () => $("calcPlane").click());
  $(id).addEventListener("change", () => $("calcPlane").click());
});
[
  "hexaId","haxyz","hbxyz","hcxyz","hdxyz","hexaThickness","hexaExtrudeDirection",
  "hexaPrecision","hexaUnits","hexaTolerance","hexaAtomskTolerance",
  "hexaAtomskInput","hexaAtomskOutput"
].forEach(id => {
  $(id).addEventListener("input",calculateHexahedron);
  $(id).addEventListener("change",calculateHexahedron);
});
[
  "laxyz","lbxyz","lcxyz",
  "layerNormalDirection","layerTolerance","upperPrefix","lowerPrefix",
  "upperUnionGroup","lowerUnionGroup","moveGroup","layerPrecision",
  "layerLimitSide","layerLimitId","lvxyz",
  "lsxyz","layerLimitK"
].forEach(id => {
  $(id).addEventListener("input", syncLayerCalculations);
  $(id).addEventListener("change", syncLayerCalculations);
});
["mvxyz","alongMoveDistance","paperMoveDistance","directMoveX","directMoveY","directMoveZ"].forEach(id => {
  $(id).addEventListener("input", calculateDisplacement);
  $(id).addEventListener("change", calculateDisplacement);
});

document.querySelectorAll(".coordinate-triplet-input").forEach(input => {
  updateCalibrationCoordinateRecognition(input);
  input.addEventListener("input",()=>updateCalibrationCoordinateRecognition(input));
});

$("calcPlane").click();
calculateHexahedron();
ensureLayerCalibrationItem();
renderLayerRows();
updateLayerLimitControls();
updateMidplaneControls();
updateLayerCalibrationControls();
updateDisplacementControls();
syncLayerCalculations();

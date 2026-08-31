const $ = id => document.getElementById(id);
const EPS = 1e-12;
const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = a => Math.hypot(...a);
const scale = (a,s) => a.map(v => v*s);
const normalized = a => scale(a, 1/norm(a));

const FIXED_BATCH_DEFINITIONS={
  planePointBatch:[
    {prefix:"a",label:"A",description:"原子 A"},
    {prefix:"b",label:"B",description:"原子 B"},
    {prefix:"c",label:()=>$("planeMode")?.value==="line" ? "E" : "C",description:()=>$("planeMode")?.value==="line" ? "延伸方向 E" : "原子 C"}
  ],
  hexaPointBatch:[
    {prefix:"ha",label:"A",description:"底面顶点 A"},
    {prefix:"hb",label:"B",description:"底面顶点 B"},
    {prefix:"hc",label:"C",description:"底面顶点 C"},
    {prefix:"hd",label:"D",description:"底面顶点 D"}
  ],
  layerPointBatch:[
    {prefix:"la",label:"A",description:"基础点 A"},
    {prefix:"lb",label:"B",description:"基础点 B"},
    {prefix:"lc",label:"C",description:"基础点 C"}
  ],
  midplanePointBatch:[
    {prefix:"midplaneP1",label:"P1",description:"界面第一侧原子"},
    {prefix:"midplaneP2",label:"P2",description:"界面第二侧原子"}
  ],
  moveDirectionPointBatch:[
    {prefix:"moveP",label:"P",description:"方向起点"},
    {prefix:"moveQ",label:"Q",description:"方向终点"}
  ],
  strainPointBatch:[
    {prefix:"strainA",label:"A",description:"局部坐标原点 A"},
    {prefix:"strainB",label:"B",description:"局部面内方向点 B"},
    {prefix:"strainC",label:"C",description:"局部面法向参考点 C"}
  ]
};
const FIXED_POINT_BINDINGS=Object.fromEntries(
  Object.entries(FIXED_BATCH_DEFINITIONS).flatMap(([inputId,definitions]) =>
    definitions.map((definition,index)=>[definition.prefix,{inputId,index,definition}])
  )
);
const fixedBatchLines=input=>input.value.replace(/\r/g,"").split("\n");
const fixedBatchText=value=>typeof value==="function" ? value() : value;
function readFixedBatchPoint(inputId,index,label) {
  const input=$(inputId);
  const line=input ? fixedBatchLines(input)[index] || "" : "";
  return parseCoordinateTriplet(line,label).point;
}
const readPoint = prefix => {
  const batchBinding=FIXED_POINT_BINDINGS[prefix];
  if (batchBinding) {
    const label=fixedBatchText(batchBinding.definition.label);
    try { return readFixedBatchPoint(batchBinding.inputId,batchBinding.index,label); }
    catch { return [NaN,NaN,NaN]; }
  }
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
  $("thirdHelp").textContent = line
    ? "E 是平面的延伸方向向量。例如从 X 方向观察 Y–Z 边界线时，填写 E=(1,0,0)。"
    : "C 是平面上的第三个原子，A、B、C 不能共线。";
  updateFixedCoordinateBatch($("planePointBatch"));
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
  const P1=readFixedBatchPoint("midplanePointBatch",0,"第一侧原子 P1");
  const P2=readFixedBatchPoint("midplanePointBatch",1,"第二侧原子 P2");
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
const layerCalibrationDrafts=new Map();

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

function updateFixedCoordinateBatch(input) {
  if (!input) return;
  const definitions=FIXED_BATCH_DEFINITIONS[input.id];
  const output=input.closest(".coordinate-batch-entry")?.querySelector(".coordinate-batch-recognition");
  if (!definitions || !output) return;
  const lines=fixedBatchLines(input);
  output.textContent="";
  definitions.forEach((definition,index) => {
    const label=fixedBatchText(definition.label);
    const description=fixedBatchText(definition.description);
    const row=document.createElement("p");
    row.className="coordinate-batch-recognition-row";
    const line=(lines[index] || "").trim();
    if (!line) {
      row.textContent=`第 ${index+1} 行 · ${label}（${description}）：等待 XYZ`;
      row.dataset.state="empty";
    } else {
      try {
        const {point,extraCount}=parseCoordinateTriplet(line,`${label}（第 ${index+1} 行）`);
        row.textContent=`第 ${index+1} 行 · ${label} = (${point.join(", ")})${extraCount ? `；另有 ${extraCount} 个数字未使用` : ""}`;
        row.dataset.state=extraCount ? "warning" : "valid";
      } catch(error) {
        row.textContent=`第 ${index+1} 行 · ${label}：${error.message}`;
        row.dataset.state="invalid";
      }
    }
    output.appendChild(row);
  });
  const extraRows=lines
    .map((line,index)=>({line:line.trim(),index}))
    .filter(row=>row.index>=definitions.length && row.line);
  if (extraRows.length) {
    const warning=document.createElement("p");
    warning.className="coordinate-batch-recognition-row";
    warning.dataset.state="warning";
    warning.textContent=`第 ${extraRows.map(row=>row.index+1).join("、")} 行超出本组需要的 ${definitions.length} 个点，未参与计算。`;
    output.appendChild(warning);
  }
}

function nonEmptyCoordinateRows(input) {
  if (!input) return [];
  return input.value.replace(/\r/g,"").split("\n")
    .map((text,lineIndex)=>({text:text.trim(),lineIndex}))
    .filter(row=>row.text);
}

function updateCalibrationBatchRecognition(input) {
  const item=input.closest(".calibration-item");
  const card=input.closest(".calibration-point-card");
  const output=card?.querySelector(".calibration-batch-recognition");
  if (!item || !output) return;
  const role=input.dataset.pointRole;
  const prefix=role==="inside" ? "P_in" : "P_out";
  const rows=nonEmptyCoordinateRows(input);
  output.textContent="";
  if (!rows.length) {
    const waiting=document.createElement("p");
    waiting.className="coordinate-batch-recognition-row";
    waiting.dataset.state="empty";
    waiting.textContent="等待粘贴坐标；每个非空行识别为一个原子。";
    output.appendChild(waiting);
  } else {
    rows.forEach((row,index) => {
      const recognition=document.createElement("p");
      recognition.className="coordinate-batch-recognition-row";
      try {
        const {point,extraCount}=parseCoordinateTriplet(row.text,`${prefix}${index+1}（原第 ${row.lineIndex+1} 行）`);
        recognition.textContent=`第 ${row.lineIndex+1} 行 · ${prefix}${index+1} = (${point.join(", ")})${extraCount ? `；另有 ${extraCount} 个数字未使用` : ""}`;
        recognition.dataset.state=extraCount ? "warning" : "valid";
      } catch(error) {
        recognition.textContent=`第 ${row.lineIndex+1} 行 · ${prefix}${index+1}：${error.message}`;
        recognition.dataset.state="invalid";
      }
      output.appendChild(recognition);
    });
  }
  updateCalibrationItemBrief(item);
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
    const upperName=`${upperPrefix}_${index}`;
    const lowerName=`${lowerPrefix}_${index}`;
    targets.push(
      {value:`upper:${index}`,name:upperName,detail:`第 ${index} 排上层 · 中心面 +n 侧`,kind:"upper",index},
      {value:`lower:${index}`,name:lowerName,detail:`第 ${index} 排下层 · 中心面 −n 侧`,kind:"lower",index}
    );
  }
  return targets;
}

function updateCalibrationItemBrief(item,statusText) {
  if (statusText!==undefined) item.dataset.calibrationStatus=statusText;
  const targetLabel=item.querySelector(".calibration-target-name")?.textContent || "未确定目标层";
  const insideCount=nonEmptyCoordinateRows(item.querySelector('.calibration-points-input[data-point-role="inside"]')).length;
  const outsideCount=nonEmptyCoordinateRows(item.querySelector('.calibration-points-input[data-point-role="outside"]')).length;
  const status=item.dataset.calibrationStatus || "等待坐标";
  item.querySelector(".calibration-item-brief").textContent=`${targetLabel} · 层内 ${insideCount} 点 / 层外 ${outsideCount} 点 · ${status}`;
}

function setLayerCalibrationItemCollapsed(item,collapsed) {
  item.classList.toggle("collapsed",collapsed);
  const button=item.querySelector(".calibration-toggle");
  button.textContent=collapsed ? "展开此组" : "收起此组";
  button.setAttribute("aria-expanded",String(!collapsed));
}

function updateCalibrationTargetDisplay(item,target) {
  item.dataset.targetValue=target.value;
  item.dataset.targetKind=target.kind;
  item.dataset.targetIndex=String(target.index);
  item.querySelector(".calibration-item-heading").textContent=`${target.name} 参考原子`;
  item.querySelector(".calibration-target-name").textContent=target.name;
  item.querySelector(".calibration-target-detail").textContent=target.detail;
  updateCalibrationItemBrief(item);
}

function saveLayerCalibrationDraft(item) {
  const targetValue=item.dataset.targetValue;
  if (!targetValue) return;
  layerCalibrationDrafts.set(targetValue,{
    inside:item.querySelector('.calibration-points-input[data-point-role="inside"]')?.value || "",
    outside:item.querySelector('.calibration-points-input[data-point-role="outside"]')?.value || "",
    collapsed:item.classList.contains("collapsed")
  });
}

function createLayerCalibrationItem(target,shouldSync=true) {
  if (!target) return null;
  const item=document.createElement("section");
  const itemId=++layerCalibrationItemCounter;
  const draft=layerCalibrationDrafts.get(target.value);
  item.className="calibration-item";
  item.dataset.calibrationId=String(itemId);
  item.innerHTML=`
    <div class="calibration-item-header">
      <div class="calibration-item-title">
        <h4 class="calibration-item-heading"></h4>
        <p class="calibration-item-brief">等待坐标</p>
      </div>
      <div class="calibration-header-actions">
        <button class="secondary calibration-toggle" type="button" aria-expanded="true" aria-controls="calibrationBody${itemId}">收起此组</button>
      </div>
    </div>
    <div id="calibrationBody${itemId}" class="calibration-item-body">
    <div class="calibration-target-strip" aria-label="当前校准目标层">
      <span>目标层</span>
      <strong class="calibration-target-name"></strong>
      <small class="calibration-target-detail"></small>
    </div>
    <div class="calibration-point-grid">
      <div class="calibration-point-card">
        <h4>必须在目标层内的原子</h4>
        <p class="help">在一个框内粘贴全部层内点；每个非空行自动识别为 P_in1、P_in2……</p>
        <textarea id="calibrationInside${itemId}" class="calibration-points-input" data-point-role="inside" rows="3" autocomplete="off" spellcheck="false" placeholder="每行一个 XYZ 坐标，例如：&#10;14.0199 261.154 125.018&#10;12.5444 263.710 125.019"></textarea>
        <div class="coordinate-batch-recognition calibration-batch-recognition" aria-live="polite"></div>
      </div>
      <div class="calibration-point-card">
        <h4>必须在目标层外的原子</h4>
        <p class="help">在一个框内粘贴全部层外点；每个非空行自动识别为 P_out1、P_out2……</p>
        <textarea id="calibrationOutside${itemId}" class="calibration-points-input" data-point-role="outside" rows="3" autocomplete="off" spellcheck="false" placeholder="每行一个 XYZ 坐标，例如：&#10;14.0199 266.265 125.020&#10;12.5444 258.598 125.017"></textarea>
        <div class="coordinate-batch-recognition calibration-batch-recognition" aria-live="polite"></div>
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
  updateCalibrationTargetDisplay(item,target);
  item.querySelectorAll(".calibration-points-input").forEach(input => {
    input.value=input.dataset.pointRole==="inside" ? draft?.inside || "" : draft?.outside || "";
    updateCalibrationBatchRecognition(input);
    input.addEventListener("input",() => {
      updateCalibrationBatchRecognition(input);
      syncLayerCalculations();
    });
    input.addEventListener("change",syncLayerCalculations);
  });
  item.querySelector(".calibration-toggle").addEventListener("click",() => {
    setLayerCalibrationItemCollapsed(item,!item.classList.contains("collapsed"));
  });
  item.querySelector(".apply-calibration").addEventListener("click",()=>applyLayerCalibrationRecommendation(item));
  setLayerCalibrationItemCollapsed(item,draft?.collapsed ?? target.value!=="upper:1");
  if (shouldSync) syncLayerCalculations();
  return item;
}

function synchronizeLayerCalibrationItems() {
  const container=$("layerCalibrationItems");
  const targets=calibrationTargetOptions();
  const targetValues=new Set(targets.map(target=>target.value));
  const existing=new Map(layerCalibrationItems().map(item=>[item.dataset.targetValue,item]));
  existing.forEach((item,targetValue) => {
    if (targetValues.has(targetValue)) return;
    saveLayerCalibrationDraft(item);
    item.remove();
    existing.delete(targetValue);
  });
  targets.forEach(target => {
    let item=existing.get(target.value);
    if (!item) {
      item=createLayerCalibrationItem(target,false);
      existing.set(target.value,item);
    } else {
      updateCalibrationTargetDisplay(item,target);
    }
    container.appendChild(item);
  });
}

function updateLayerCalibrationControls() {
  const enabled=$("useLayerCalibration").checked;
  synchronizeLayerCalibrationItems();
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
  const input=item.querySelector(`.calibration-points-input[data-point-role="${role}"]`);
  const rows=nonEmptyCoordinateRows(input);
  if (!rows.length) throw new Error(`${label} 至少需要一个参考点。`);
  return rows.map((row,index)=>parseCoordinateTriplet(row.text,`${label}${index+1}（原第 ${row.lineIndex+1} 行）`).point);
}

function evaluateLayerCalibrationItem(item,geometry,config,rangeData,limit) {
  const kind=item.dataset.targetKind;
  const index=Number(item.dataset.targetIndex);
  if (!['upper','lower'].includes(kind) || !Number.isInteger(index)) throw new Error("无法识别该自动生成的目标层。");
  if (index<1 || index>config.count) throw new Error("该目标层已不在当前层数范围内。");
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
  return layerCalibrationItems().filter(calibrationItemHasInput).map(item => {
    try {
      return evaluateLayerCalibrationItem(item,geometry,config,rangeData,limit);
    } catch(error) {
      return {enabled:true,item,status:"input-error",error:error.message};
    }
  });
}

function calibrationItemHasInput(item) {
  return ["inside","outside"].some(role =>
    nonEmptyCoordinateRows(item.querySelector(`.calibration-points-input[data-point-role="${role}"]`)).length
  );
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
  const activeItems=new Set(calibrations.map(calibration=>calibration.item));
  layerCalibrationItems().filter(item=>!activeItems.has(item)).forEach(item => {
    updateCalibrationItemBrief(item,"等待坐标");
    item.querySelector(".apply-calibration").disabled=true;
    const details=item.querySelector(".calibration-result-details");
    details.dataset.state="waiting";
    details.removeAttribute("open");
    item.querySelector(".calibration-result-summary").textContent="等待填写本层参考点";
    const message=item.querySelector(".calibration-message");
    message.textContent="";
    message.className="message calibration-message warn";
  });
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
  const waitingCount=layerCalibrationItems().length-calibrations.length;
  if (waitingCount) parts.push(`${waitingCount} 层未填写`);
  $("layerCalibrationOut").textContent=parts.length ? parts.join("，") : "等待填写任一目标层";
  const state=counts.conflict ? "conflict" : counts.adjustable ? "adjustable" : counts["input-error"] ? "input-error" : counts.pass ? "pass" : "waiting";
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
  if (!Number.isInteger(count) || count<1 || count>20) {
    synchronizeLayerCalibrationItems();
    return;
  }
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
  synchronizeLayerCalibrationItems();
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
      : calibrations.length
        ? calibrations.map(calibration => {
          const targetName=calibration.item.querySelector(".calibration-target-name")?.textContent || "目标层";
          return calibration.error
            ? `[${targetName}] 尚未完成：${calibration.error}`
            : `[${targetName}]\n${calibration.explanation}`;
        }).join("\n\n")
        : "所有 upper / lower 目标层的参考原子框已自动生成；尚未填写任何层的校准坐标。";
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
        const P=readFixedBatchPoint("moveDirectionPointBatch",0,"方向起点 P");
        const Q=readFixedBatchPoint("moveDirectionPointBatch",1,"方向终点 Q");
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

const STRAIN_COMPONENT_KEYS=["n1","n2","n3","s12","s13","s23"];
const STRAIN_COMPONENT_INPUTS={
  n1:"strainNormal1",n2:"strainNormal2",n3:"strainNormal3",
  s12:"strainShear12",s13:"strainShear13",s23:"strainShear23"
};
const STRAIN_COMPONENT_LABELS={
  global:{n1:"εxx",n2:"εyy",n3:"εzz",s12:"γxy",s13:"γxz",s23:"γyz"},
  plane:{n1:"εtt",n2:"εqq",n3:"εnn",s12:"γtq",s13:"γtn",s23:"γqn"}
};
const STRAIN_GLOBAL_FIX_COMPONENTS=[
  {key:"n1",parameter:"x",variable:"eps_x",rate:"erate_x",normal:true},
  {key:"n2",parameter:"y",variable:"eps_y",rate:"erate_y",normal:true},
  {key:"n3",parameter:"z",variable:"eps_z",rate:"erate_z",normal:true},
  {key:"s12",parameter:"xy",variable:"gamma_xy",rate:"erate_xy",normal:false},
  {key:"s13",parameter:"xz",variable:"gamma_xz",rate:"erate_xz",normal:false},
  {key:"s23",parameter:"yz",variable:"gamma_yz",rate:"erate_yz",normal:false}
];
const STRAIN_UNIT_INFO={
  metal:{time:"ps",nativePressure:"bar",gpaFactor:1e-4},
  real:{time:"fs",nativePressure:"atm",gpaFactor:0.000101325},
  si:{time:"s",nativePressure:"Pa",gpaFactor:1e-9}
};

function numericInput(id,label) {
  const value=Number($(id).value);
  if (!Number.isFinite(value)) throw new Error(`请填写有效的${label}。`);
  return value;
}

function strainTensorFromComponents(components) {
  return [
    [components.n1,components.s12/2,components.s13/2],
    [components.s12/2,components.n2,components.s23/2],
    [components.s13/2,components.s23/2,components.n3]
  ];
}

function strainComponentsFromTensor(tensor) {
  return {
    n1:tensor[0][0],n2:tensor[1][1],n3:tensor[2][2],
    s12:tensor[0][1]+tensor[1][0],
    s13:tensor[0][2]+tensor[2][0],
    s23:tensor[1][2]+tensor[2][1]
  };
}

function transformStrainTensorToGlobal(localTensor,basis) {
  return Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>{
    let value=0;
    for (let a=0;a<3;a++) for (let b=0;b<3;b++) {
      value+=basis[a][i]*localTensor[a][b]*basis[b][j];
    }
    return value;
  }));
}

function renderStrainMatrix(id,matrix,precision=8) {
  const target=$(id);
  target.innerHTML="";
  matrix.flat().forEach(value=>{
    const cell=document.createElement("span");
    cell.textContent=Number.isFinite(value) ? clean(value,precision) : "—";
    target.appendChild(cell);
  });
}

function getStrainBasis() {
  const mode=$("strainCoordinateMode").value;
  if (mode==="global") {
    return {mode,basis:[[1,0,0],[0,1,0],[0,0,1]],A:null,t:[1,0,0],q:[0,1,0],n:[0,0,1],yzAligned:true};
  }
  const A=readPoint("strainA"),B=readPoint("strainB"),C=readPoint("strainC");
  if (![A,B,C].every(validPoint)) throw new Error("请为局部坐标系粘贴完整的 A、B、C 三行坐标。");
  const AB=sub(B,A),AC=sub(C,A);
  if (norm(AB)<EPS) throw new Error("局部坐标的 A、B 不能重合。");
  let n=cross(AB,AC);
  if (norm(n)<EPS) throw new Error("局部坐标的 A、B、C 共线，无法确定面法向。");
  const t=normalized(AB);
  n=normalized(n);
  if ($("strainNormalDirection").value==="reverse") n=scale(n,-1);
  const q=normalized(cross(n,t));
  const yzAligned=Math.abs(Math.abs(dot(t,[0,1,0]))-1)<1e-8 && Math.abs(Math.abs(dot(n,[0,0,1]))-1)<1e-8;
  return {mode,basis:[t,q,n],A,B,C,t,q,n,yzAligned};
}

function getStrainTargetComponents(mode) {
  if ($("strainMagnitudeMode").value==="matrix") {
    return Object.fromEntries(STRAIN_COMPONENT_KEYS.map(key=>[
      key,numericInput(STRAIN_COMPONENT_INPUTS[key],STRAIN_COMPONENT_LABELS[mode][key])
    ]));
  }
  const length=numericInput("strainNormalLength","初始法向长度 L0");
  const tangential=numericInput("strainTangentialDisplacement","切向相对位移 Δt");
  const normalChange=numericInput("strainNormalChange","法向长度变化 ΔL");
  if (length<=0) throw new Error("初始法向长度 L0 必须大于 0。");
  const components={n1:0,n2:0,n3:normalChange/length,s12:0,s13:0,s23:0};
  if (mode==="global") components.s23=tangential/length;
  else components.s13=tangential/length;
  return components;
}

function updateStrainControls() {
  const mode=$("strainCoordinateMode").value;
  const matrixMode=$("strainMagnitudeMode").value==="matrix";
  const labels=STRAIN_COMPONENT_LABELS[mode];
  $("strainPlaneBasisFields").classList.toggle("hidden",mode!=="plane");
  $("strainMatrixFields").classList.toggle("hidden",!matrixMode);
  $("strainDisplacementFields").classList.toggle("hidden",matrixMode);
  STRAIN_COMPONENT_KEYS.forEach(key=>{
    const inputId=STRAIN_COMPONENT_INPUTS[key];
    $(`${inputId}Label`).textContent=labels[key];
    const option=$("strainReferenceComponent").querySelector(`option[value="${key}"]`);
    if (option) option.textContent=labels[key];
  });
  $("strainComponentHelp").textContent=mode==="global"
    ? "按 LAMMPS 全局 X/Y/Z 填写；剪切分量使用工程剪切应变 γ，张量非对角元显示为 γ/2。"
    : "局部 t=A→B、n 为面法向、q=n×t；剪切分量使用工程剪切应变 γ，张量非对角元显示为 γ/2。";
  $("strainDisplacementHelp").textContent=mode==="global"
    ? "全局 YZ 快捷换算：γyz=ΔY/Lz0，εzz=ΔLz/Lz0。"
    : "倾斜面局部换算：γtn=Δt/Ln0，εnn=ΔLn/Ln0；随后投影到全局 XYZ。";
  $("strainInputMatrixHeading").textContent=mode==="global" ? "输入的全局工程应变张量" : "输入的局部 t / q / n 应变张量";
  const rateMode=$("strainScheduleMode").value==="rate";
  $("strainReferenceComponentField").classList.toggle("hidden",!rateMode);
  $("strainReferenceRateField").classList.toggle("hidden",!rateMode);
  $("strainLoadTimeField").classList.toggle("hidden",rateMode);
  const volumeMode=$("strainVolumeMode").value;
  $("strainEffectiveZField").classList.toggle("hidden",!["effectiveZ","effectiveZInitial"].includes(volumeMode));
  $("strainManualVolumeField").classList.toggle("hidden",volumeMode!=="manual");
}

function strainRatioText(components,labels) {
  const maximum=Math.max(...STRAIN_COMPONENT_KEYS.map(key=>Math.abs(components[key])));
  if (maximum<EPS) return "全部为 0";
  return STRAIN_COMPONENT_KEYS.map(key=>`${labels[key]}=${clean(components[key]/maximum,6)}`).join("；");
}

function lammpsSubstitution(name) {
  return "${"+name+"}";
}

function strainVolumeDefinition() {
  const mode=$("strainVolumeMode").value;
  if (mode==="box") return {lines:["variable CorVol equal vol"],description:"当前整个模拟盒体积 vol"};
  if (mode==="boxInitial") return {
    lines:["variable strain_vol0 equal $(vol)","variable CorVol equal v_strain_vol0"],
    description:"加载开始时的整个盒体积 vol0"
  };
  if (["effectiveZ","effectiveZInitial"].includes(mode)) {
    const excluded=numericInput("strainExcludedZ","Z 方向排除厚度");
    if (excluded<0) throw new Error("Z 方向排除厚度不能小于 0。");
    if (mode==="effectiveZInitial") return {
      lines:[
        `variable excluded_z equal ${clean(excluded,12)}`,
        "variable strain_lx0 equal $(lx)",
        "variable strain_ly0 equal $(ly)",
        "variable strain_lz0 equal $(lz)",
        "variable CorVol equal v_strain_lx0*v_strain_ly0*(v_strain_lz0-v_excluded_z)"
      ],
      description:`初始 lx0×ly0×(lz0−${clean(excluded,8)})`
    };
    return {
      lines:[`variable excluded_z equal ${clean(excluded,12)}`,"variable CorVol equal lx*ly*(lz-v_excluded_z)"],
      description:`lx×ly×(lz−${clean(excluded,8)})`
    };
  }
  const expression=$("strainManualVolume").value.trim();
  if (!expression || /[\r\n]/.test(expression)) throw new Error("自定义体积必须是一行有效的 LAMMPS equal 表达式。");
  return {lines:[`variable CorVol equal ${expression}`],description:`自定义：${expression}`};
}

function tensorProjectionExpression(left,right,prefix) {
  const names=["xx","yy","zz","xy","xz","yz"];
  const coefficients=[
    left[0]*right[0],left[1]*right[1],left[2]*right[2],
    left[0]*right[1]+left[1]*right[0],
    left[0]*right[2]+left[2]*right[0],
    left[1]*right[2]+left[2]*right[1]
  ];
  const terms=coefficients.map((coefficient,index)=>({coefficient,name:names[index]})).filter(term=>Math.abs(term.coefficient)>1e-12);
  if (!terms.length) return "0.0";
  return terms.map((term,index)=>{
    const absolute=clean(Math.abs(term.coefficient),12);
    const body=`${absolute}*v_${prefix}_${term.name}_GPa`;
    if (index===0) return term.coefficient<0 ? `-${body}` : body;
    return term.coefficient<0 ? ` - ${body}` : ` + ${body}`;
  }).join("");
}

function calculateStrainMatrix() {
  clearMessage("strainMessage");
  try {
    updateStrainControls();
    const precision=10;
    const basisData=getStrainBasis();
    const mode=basisData.mode;
    const labels=STRAIN_COMPONENT_LABELS[mode];
    const inputComponents=getStrainTargetComponents(mode);
    const inputTensor=strainTensorFromComponents(inputComponents);
    const globalTensor=mode==="global" ? inputTensor : transformStrainTensorToGlobal(inputTensor,basisData.basis);
    const globalComponents=strainComponentsFromTensor(globalTensor);
    const maximumTarget=Math.max(...STRAIN_COMPONENT_KEYS.map(key=>Math.abs(globalComponents[key])));
    if (maximumTarget<EPS) throw new Error("六个目标应变分量不能全部为 0。");
    ["n1","n2","n3"].forEach(key=>{
      if (globalComponents[key]<=-1) throw new Error(`全局法向分量 ${STRAIN_COMPONENT_LABELS.global[key]} 必须大于 −1，否则盒长将变为 0 或负值。`);
    });

    let referenceKey=$("strainReferenceComponent").value;
    if (Math.abs(inputComponents[referenceKey])<EPS) {
      referenceKey=STRAIN_COMPONENT_KEYS.reduce((best,key)=>Math.abs(inputComponents[key])>Math.abs(inputComponents[best]) ? key : best,STRAIN_COMPONENT_KEYS[0]);
      $("strainReferenceComponent").value=referenceKey;
    }
    const timestep=numericInput("strainTimestep","时间步长 dt");
    if (timestep<=0) throw new Error("时间步长 dt 必须大于 0。");
    const deformEvery=numericInput("strainDeformEvery","盒子更新间隔 N");
    if (!Number.isInteger(deformEvery) || deformEvery<1) throw new Error("盒子更新间隔 N 必须是大于或等于 1 的整数。");
    let requestedTime;
    if ($("strainScheduleMode").value==="rate") {
      const rateMagnitude=numericInput("strainReferenceRate","参考应变率绝对值");
      if (rateMagnitude<=0) throw new Error("参考应变率绝对值必须大于 0。");
      requestedTime=Math.abs(inputComponents[referenceKey])/rateMagnitude;
    } else {
      requestedTime=numericInput("strainLoadTime","总加载时间");
      if (requestedTime<=0) throw new Error("总加载时间必须大于 0。");
    }
    const loadSteps=Math.max(1,Math.ceil(requestedTime/timestep-1e-10));
    const actualTime=loadSteps*timestep;
    const globalRates=Object.fromEntries(STRAIN_COMPONENT_KEYS.map(key=>[key,globalComponents[key]/actualTime]));
    const activeFixComponents=STRAIN_GLOBAL_FIX_COMPONENTS.filter(item=>Math.abs(globalComponents[item.key])>1e-12);
    const usesTilt=activeFixComponents.some(item=>!item.normal);
    const shearStyle=$("strainShearStyle").value;
    const remapMode=$("strainRemapMode").value;
    const initialBox=$("strainInitialBox").value;
    const group=$("strainGroup").value.trim();
    if (!validId(group)) throw new Error("应力统计原子组名称只能包含字母、数字和下划线，且不能以数字开头。");
    const units=$("strainUnits").value;
    const unitInfo=STRAIN_UNIT_INFO[units];
    const stressMode=$("strainStressContribution").value;
    const stressSign=$("strainStressSign").value;
    const volume=strainVolumeDefinition();
    const thermoEvery=numericInput("strainThermoEvery","thermo 输出间隔");
    if (!Number.isInteger(thermoEvery) || thermoEvery<1) throw new Error("thermo 输出间隔必须是大于或等于 1 的整数。");
    const boundary=$("strainBoundary").value.trim();
    const boundaryParts=boundary.split(/\s+/).filter(Boolean);
    if (boundaryParts.length!==3 || boundaryParts.some(part=>!/^[pfsm]{1,2}$/.test(part))) {
      throw new Error("boundary 请填写三个由 p、f、s、m 组成的方向，例如 p p p 或 p p fm。");
    }

    const onlyLocalTNShearAndNormal=STRAIN_COMPONENT_KEYS.every(key=>["n3","s13"].includes(key) || Math.abs(inputComponents[key])<1e-12);
    const exactPlaneYZ=mode==="plane" && basisData.yzAligned && onlyLocalTNShearAndNormal;
    let fidelity;
    const cautions=[];
    if (mode==="global") fidelity="全局盒分量可直接由 fix deform 施加";
    else if (exactPlaneYZ) fidelity="局部 t / n 已与全局 Y / Z 对齐，可精确转为 yz + z";
    else {
      fidelity="局部矩阵已转成全局小应变等效分量；有限应变时需先旋转模型";
      cautions.push("当前倾斜面未与 LAMMPS 盒轴对齐。生成命令保证初始小应变率张量等效，但会附带受限三斜盒表示所对应的转动；较大有限应变时，应先把局部 t、n 旋转到受支持的盒轴后再加载。");
    }
    if (mode==="plane" && maximumTarget>0.05 && !exactPlaneYZ) cautions.push("目标分量超过 5%，不应把局部到全局的小应变投影当作严格的有限应变变换。");
    if (usesTilt && Math.abs(globalComponents.n3)>EPS && shearStyle==="erate") cautions.push("同时改变垂直盒长时，erate 的剪切应变仍按初始垂直盒长定义；若要随当前盒长重标定，可在确认 LAMMPS 版本后选择 erate/rescale。");
    if (shearStyle==="erate/rescale") cautions.push("erate/rescale 需要 LAMMPS 11Feb2026 或更新版本。");
    if (stressMode==="deform" && remapMode!=="v") cautions.push("compute temp/deform 与 remap x/none 的流速假设不一致，LAMMPS 可能警告；NEMD 动能项通常应配合 remap v 与合适温控。");
    const shrinkWrapped=boundaryParts.map(part=>/[sm]/.test(part));
    const invalidShrink=activeFixComponents.some(item=>{
      const dimensionIndex=item.normal ? {x:0,y:1,z:2}[item.parameter] : {xy:1,xz:2,yz:2}[item.parameter];
      return shrinkWrapped[dimensionIndex];
    });
    if (invalidShrink) cautions.push("fix deform 所改变的盒长或倾斜分量所依赖的方向不能使用 shrink-wrap（s/m）边界；请修改 boundary 或加载分量。");

    renderStrainMatrix("strainInputMatrixOut",inputTensor,8);
    renderStrainMatrix("strainGlobalMatrixOut",globalTensor,8);
    $("strainBasisOut").textContent=mode==="global"
      ? "全局 X=(1,0,0)，Y=(0,1,0)，Z=(0,0,1)"
      : `t=${vectorText(basisData.t,8)}；q=${vectorText(basisData.q,8)}；n=${vectorText(basisData.n,8)}`;
    $("strainComponentsOut").textContent=STRAIN_COMPONENT_KEYS.map(key=>`${STRAIN_COMPONENT_LABELS.global[key]}=${clean(globalComponents[key],8)}`).join("；");
    $("strainRatioOut").textContent=strainRatioText(inputComponents,labels);
    $("strainScheduleOut").textContent=`T=${clean(actualTime,10)} ${unitInfo.time}；${loadSteps} 步；dt=${clean(timestep,12)} ${unitInfo.time}`;
    $("strainFidelityOut").textContent=fidelity;
    $("strainStressIndexOut").textContent=`stress/atom 顺序 xx, yy, zz, xy, xz, yz；[3]=zz，[6]=yz；另输出局部 tn / nn 投影；${unitInfo.nativePressure}→GPa`;

    const targetLines=activeFixComponents.map(item=>`variable final_${item.parameter} equal ${clean(globalComponents[item.key],12)}`);
    const rateLines=activeFixComponents.map(item=>`variable ${item.rate} equal ${clean(globalRates[item.key],12)}`);
    const strainVariableLines=activeFixComponents.map(item=>`variable ${item.variable} equal v_${item.rate}*(step-v_load_start)*dt`);
    const fixArguments=activeFixComponents.map(item=>{
      const style=item.normal ? "erate" : shearStyle;
      return `${item.parameter} ${style} ${lammpsSubstitution(item.rate)}`;
    }).join(" ");
    const triclinicLine=usesTilt && initialBox==="orthogonal" ? "change_box all triclinic\n" : "";
    const stressComputeLines=stressMode==="virial"
      ? [`compute strainStressAtom ${group} stress/atom NULL virial`]
      : stressMode==="deform"
        ? [`compute strainTemp ${group} temp/deform`,`compute strainStressAtom ${group} stress/atom strainTemp`]
        : [`compute strainStressAtom ${group} stress/atom NULL`];
    const stressFactor=clean(unitInfo.gpaFactor,12);
    const stressPrefix=stressSign==="pressure" ? "p" : "sigma";
    const stressSignPrefix=stressSign==="pressure" ? "-" : "";
    const stressNames=["xx","yy","zz","xy","xz","yz"];
    const stressVariableLines=stressNames.map((name,index)=>
      `variable ${stressPrefix}_${name}_GPa equal ${stressSignPrefix}(c_strainStressSum[${index+1}]/(v_CorVol+1.0e-30))*${stressFactor}`
    );
    const projectionT=mode==="global" ? [0,1,0] : basisData.t;
    const projectionN=mode==="global" ? [0,0,1] : basisData.n;
    stressVariableLines.push(
      `variable ${stressPrefix}_tn_GPa equal ${tensorProjectionExpression(projectionT,projectionN,stressPrefix)}`,
      `variable ${stressPrefix}_nn_GPa equal ${tensorProjectionExpression(projectionN,projectionN,stressPrefix)}`
    );
    const thermoVariables=[...stressNames.map(name=>`v_${stressPrefix}_${name}_GPa`),`v_${stressPrefix}_tn_GPa`,`v_${stressPrefix}_nn_GPa`].join(" ");
    const liveStrainVariables=activeFixComponents.map(item=>`v_${item.variable}`).join(" ");
    const commandLines=[
      `timestep ${clean(timestep,12)}`,
      ...targetLines,
      ...rateLines,
      `variable load_steps equal ${loadSteps}`,
      "variable load_start equal $(step)",
      "",
      ...(triclinicLine ? [triclinicLine.trimEnd()] : []),
      `fix strainBox all deform ${deformEvery} ${fixArguments} remap ${remapMode} units box`,
      "",
      ...stressComputeLines,
      "compute strainStressSum " + group + " reduce sum c_strainStressAtom[1] c_strainStressAtom[2] c_strainStressAtom[3] c_strainStressAtom[4] c_strainStressAtom[5] c_strainStressAtom[6]",
      ...volume.lines,
      ...stressVariableLines,
      ...strainVariableLines,
      "",
      `thermo ${thermoEvery}`,
      `thermo_style custom step temp ${liveStrainVariables} ${thermoVariables}`.replace(/\s+/g," ").trim(),
      `run ${lammpsSubstitution("load_steps")}`,
      "unfix strainBox"
    ];
    const commandText=commandLines.join("\n");
    $("strainCode").textContent=commandText;

    const dataFile=$("strainDataFile").value.trim();
    if (!dataFile || /[\r\n]/.test(dataFile)) throw new Error("IN 骨架的数据文件名不能为空或包含换行。");
    const atomStyle=$("strainAtomStyle").value;
    const potential=$("strainPotentialCommands").value.trim();
    const potentialBlock=potential || "# TODO: 在这里粘贴与你的材料一致的 mass、pair_style、pair_coeff 命令";
    const groupRequirement=group==="all" ? "" : `\n# TODO: 在加载前定义原子组 ${group}；可直接粘贴第三板块生成的 group 命令`;
    $("strainInCode").textContent=
`units ${units}
atom_style ${atomStyle}
boundary ${boundary}
read_data ${dataFile}

${potentialBlock}${groupRequirement}

# 根据体系补充最小化、积分器和温控命令后，再执行以下加载段
${commandText}

write_data strained.data`;

    const sourceText=$("strainMagnitudeMode").value==="matrix"
      ? "六个目标工程应变分量由用户直接给出。"
      : mode==="global"
        ? `由 Lz0、ΔY、ΔLz 换算：γyz=ΔY/Lz0=${clean(inputComponents.s23,8)}，εzz=ΔLz/Lz0=${clean(inputComponents.n3,8)}。`
        : `由 Ln0、Δt、ΔLn 换算：γtn=Δt/Ln0=${clean(inputComponents.s13,8)}，εnn=ΔLn/Ln0=${clean(inputComponents.n3,8)}。`;
    const rateText=activeFixComponents.map(item=>`${STRAIN_COMPONENT_LABELS.global[item.key]}率=${clean(globalRates[item.key],12)} /${unitInfo.time}`).join("；");
    $("strainExplanation").textContent=
`三个面上点只能给出方向：A→B 定义局部 t，A→B×A→C 定义局部 n；它们不能决定应变幅值。若要由变形前后原子坐标反算完整三维形变梯度，至少需要四个不共面的对应点。
${sourceText}
所有非零分量使用同一加载时间 T=${clean(actualTime,10)} ${unitInfo.time}，因此比例由目标应变自动保持：${rateText}。
默认示例 γyz=+0.2、εzz=−0.2，所以两者速率比例为 +1:−1；参考率 0.0001 /ps 时分别为 +0.0001 与 −0.0001 /ps。
stress/atom 的六列正确顺序是 xx、yy、zz、xy、xz、yz，所以 zz 用 [3]，yz 用 [6]。程序还将全局张量投影成局部 ${stressPrefix}_tn 与 ${stressPrefix}_nn；其结果是压力×体积且等于压力张量的负值。当前代表体积为${volume.description}，符号采用${stressSign==="pressure" ? "压缩为正" : "拉伸为正"}。
units ${units} 的原生压力单位是 ${unitInfo.nativePressure}，当前 GPa 换算因子为 ${stressFactor}。${cautions.length ? "\n注意："+cautions.join("\n") : ""}`;
    if (cautions.length) showMessage("strainMessage",cautions.join("\n"),"warn");
  } catch(error) {
    ["strainBasisOut","strainComponentsOut","strainRatioOut","strainScheduleOut","strainFidelityOut"].forEach(id=>$(id).textContent="—");
    renderStrainMatrix("strainInputMatrixOut",Array.from({length:3},()=>[NaN,NaN,NaN]));
    renderStrainMatrix("strainGlobalMatrixOut",Array.from({length:3},()=>[NaN,NaN,NaN]));
    $("strainExplanation").textContent="请修正输入参数后重新计算。";
    $("strainCode").textContent="请修正输入参数后重新计算。";
    $("strainInCode").textContent="请修正输入参数后重新计算。";
    showMessage("strainMessage",error.message);
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
    if (!calibration.recommendation) throw new Error("当前参考点没有可应用的目标层厚度，请先根据校准提示调整点或其他边界参数。");
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
document.querySelectorAll("[data-limit-point-source]").forEach(button => {
  button.addEventListener("click", () => {
    clearMessage("layerMessage");
    try {
      const source=button.dataset.limitPointSource;
      if (!["A","B","C"].includes(source)) throw new Error("请选择有效的基础点 A、B 或 C。");
      const geometry=getLayerGeometry();
      const selectedPoint=geometry[source].map(value=>Number(clean(value,geometry.precision)));
      assignPoint("ls",selectedPoint);
      syncLayerCalculations();
    } catch(error) {
      showMessage("layerMessage",error.message);
    }
  });
});
$("useMidplanePosition").addEventListener("change", () => { updateMidplaneControls(); syncLayerCalculations(); });
$("midplanePointBatch").addEventListener("input",syncLayerCalculations);
$("midplanePointBatch").addEventListener("change",syncLayerCalculations);
$("useLayerCalibration").addEventListener("change", () => { updateLayerCalibrationControls(); syncLayerCalculations(); });
["upperPrefix","lowerPrefix"].forEach(id => {
  $(id).addEventListener("input",synchronizeLayerCalibrationItems);
  $(id).addEventListener("change",synchronizeLayerCalibrationItems);
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
$("moveDirectionPointBatch").addEventListener("input",calculateDisplacement);
$("moveDirectionPointBatch").addEventListener("change",calculateDisplacement);
$("calcLayers").addEventListener("click", syncLayerCalculations);
$("calcDisplacement").addEventListener("click", calculateDisplacement);
$("layerExample").addEventListener("click", () => {
  assignPoint("la",[0,0,0]);
  assignPoint("lb",[10,0,10]);
  assignPoint("lc",[0,10,0]);
  $("layerNormalDirection").value="forward";
  $("useMidplanePosition").checked=false;
  $("midplanePointBatch").value="";
  updateFixedCoordinateBatch($("midplanePointBatch"));
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
  $("moveDirectionPointBatch").value="";
  updateFixedCoordinateBatch($("moveDirectionPointBatch"));
  $("alongMoveDistance").value=0.5536; $("paperMoveDistance").value=0;
  $("directMoveX").value=0.5536; $("directMoveY").value=0; $("directMoveZ").value=0;
  updateDisplacementControls();
  syncLayerCalculations();
});

function assignPoint(prefix,p) {
  const batchBinding=FIXED_POINT_BINDINGS[prefix];
  if (batchBinding) {
    const input=$(batchBinding.inputId);
    const lines=fixedBatchLines(input);
    const minimumLength=FIXED_BATCH_DEFINITIONS[batchBinding.inputId].length;
    while (lines.length<minimumLength) lines.push("");
    lines[batchBinding.index]=p.join(" ");
    input.value=lines.join("\n");
    updateFixedCoordinateBatch(input);
    return;
  }
  const tripletInput=$(prefix+"xyz");
  if (tripletInput) {
    tripletInput.value=p.join(" ");
    updateCalibrationCoordinateRecognition(tripletInput);
    return;
  }
  ["x","y","z"].forEach((axis,i)=>$(prefix+axis).value=p[i]);
}

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
  "planeMode","planeId","planePointBatch",
  "useInside","qxyz","planeSide","planePrecision","planeUnits","atomskInput","atomskOutput","atomskTolerance"
].forEach(id => {
  $(id).addEventListener("input", () => $("calcPlane").click());
  $(id).addEventListener("change", () => $("calcPlane").click());
});
[
  "hexaId","hexaPointBatch","hexaThickness","hexaExtrudeDirection",
  "hexaPrecision","hexaUnits","hexaTolerance","hexaAtomskTolerance",
  "hexaAtomskInput","hexaAtomskOutput"
].forEach(id => {
  $(id).addEventListener("input",calculateHexahedron);
  $(id).addEventListener("change",calculateHexahedron);
});
[
  "layerPointBatch",
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

[
  "strainCoordinateMode","strainPointBatch","strainNormalDirection","strainMagnitudeMode",
  "strainNormal1","strainNormal2","strainNormal3","strainShear12","strainShear13","strainShear23",
  "strainNormalLength","strainTangentialDisplacement","strainNormalChange",
  "strainScheduleMode","strainReferenceComponent","strainReferenceRate","strainLoadTime",
  "strainTimestep","strainDeformEvery","strainShearStyle","strainRemapMode","strainInitialBox",
  "strainGroup","strainUnits","strainStressContribution","strainStressSign","strainVolumeMode",
  "strainExcludedZ","strainManualVolume","strainThermoEvery","strainDataFile","strainAtomStyle","strainBoundary","strainPotentialCommands"
].forEach(id=>{
  $(id).addEventListener("input",calculateStrainMatrix);
  $(id).addEventListener("change",calculateStrainMatrix);
});
$("calcStrain").addEventListener("click",calculateStrainMatrix);
$("copyLayerPlaneToStrain").addEventListener("click",()=>{
  $("strainPointBatch").value=$("layerPointBatch").value;
  $("strainNormalDirection").value=$("layerNormalDirection").value;
  updateFixedCoordinateBatch($("strainPointBatch"));
  calculateStrainMatrix();
});
$("strainBasisExample").addEventListener("click",()=>{
  $("strainPointBatch").value="0 0 0\n0 10 0\n-10 0 0";
  $("strainNormalDirection").value="forward";
  updateFixedCoordinateBatch($("strainPointBatch"));
  calculateStrainMatrix();
});
$("strainExample").addEventListener("click",()=>{
  $("strainCoordinateMode").value="global";
  $("strainMagnitudeMode").value="matrix";
  $("strainNormal1").value=0; $("strainNormal2").value=0; $("strainNormal3").value=-0.2;
  $("strainShear12").value=0; $("strainShear13").value=0; $("strainShear23").value=0.2;
  $("strainScheduleMode").value="rate";
  $("strainReferenceComponent").value="s23";
  $("strainReferenceRate").value=0.0001;
  $("strainTimestep").value=0.001;
  $("strainDeformEvery").value=1;
  $("strainShearStyle").value="erate";
  $("strainRemapMode").value="x";
  $("strainUnits").value="metal";
  $("strainStressContribution").value="virial";
  $("strainStressSign").value="pressure";
  calculateStrainMatrix();
});

document.querySelectorAll(".coordinate-triplet-input").forEach(input => {
  updateCalibrationCoordinateRecognition(input);
  input.addEventListener("input",()=>updateCalibrationCoordinateRecognition(input));
});
document.querySelectorAll(".fixed-coordinate-batch").forEach(input => {
  updateFixedCoordinateBatch(input);
  input.addEventListener("input",()=>updateFixedCoordinateBatch(input));
  input.addEventListener("change",()=>updateFixedCoordinateBatch(input));
});

$("calcPlane").click();
calculateHexahedron();
renderLayerRows();
updateLayerLimitControls();
updateMidplaneControls();
updateLayerCalibrationControls();
updateDisplacementControls();
syncLayerCalculations();
updateStrainControls();
calculateStrainMatrix();

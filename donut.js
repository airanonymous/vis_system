/* donut.js – nine‑emotion donut (pretty version)
   • IDs: M01 / F01 / M02 …   (no “Ses” prefix)
   • Full emotion labels
*/

(() => {

  /* ---------- CONFIG ---------- */
  const FILE  = "iemocap_full_dataset 2.csv";
  const EMOS  = ["ang","sad","hap","fru","neu","exc","sur","fea","dis"];
  const EMO_LABEL = {
    ang:"Anger", sad:"Sadness", hap:"Happiness", fru:"Frustration",
    neu:"Neutral", exc:"Excitement", sur:"Surprise", fea:"Fear", dis:"Disgust"
  };
  const COLORS = d3.scaleOrdinal(EMOS, d3.schemeTableau10);

  const W=960, H=520, M={top:20,right:30,bottom:20,left:30},
        IW=W-M.left-M.right, IH=H-M.top-M.bottom,
        R=Math.min(IW,IH)/2 - 10;

  let rows=[], hidden={}, svg, arc, tooltip, speakerSel;

  /* ---------- INIT ---------- */
  function init(container){
    const holder=d3.select(container);

    /* controls */
    speakerSel = holder.append("div").style("margin-bottom","1rem")
      .append("label").text("Speaker: ")
      .append("select").on("change",draw);

    /* svg scaffold */
    svg = holder.append("svg").attr("width",W).attr("height",H)
          .append("g").attr("transform",`translate(${IW/2},${IH/2})`);
    arc = d3.arc().innerRadius(R*0.45).outerRadius(R);
    tooltip = d3.select("body").append("div").attr("class","tooltip");

    /* legend */
    const legend = holder.append("div").style("margin-top","12px")
      .selectAll("span.leg").data(EMOS).enter().append("span")
        .attr("class","leg")
        .style("display","inline-flex").style("align-items","center")
        .style("margin-right","14px").style("cursor","pointer")
        .on("click",function(_,emo){
          hidden[emo]=!hidden[emo];
          d3.select(this).select(".swatch").style("opacity",hidden[emo]?0.25:1);
          draw();
        });

    legend.append("span").attr("class","swatch")
      .style("width","14px").style("height","14px")
      .style("border-radius","3px").style("margin-right","6px")
      .style("background",d=>COLORS(d));

    legend.append("span").text(d=>EMO_LABEL[d]);

    /* load csv */
    d3.csv(FILE,d3.autoType).then(data=>{
      rows=data.map(d=>{
        /*  Ses01F → F01   |   fallback:  F01 if pattern fails */
        const m=d.path.match(/Ses(\d{2})([FM])/);
        const id=m ? `${m[2]}${m[1]}` : `${d.gender}${String(d.session).padStart(2,"0")}`;
        d.speaker=id;
        return d;
      });
      const speakers=[...new Set(rows.map(d=>d.speaker))].sort();
      speakerSel.selectAll("option").data(["all",...speakers]).enter()
        .append("option").attr("value",d=>d).text(d=>d==="all"?"All":d);
      draw();
    });
  }

  /* ---------- DRAW ---------- */
  function draw(){
    if(!rows.length) return;

    const id = speakerSel.property("value") || "all";
    const subset = id==="all" ? rows : rows.filter(d=>d.speaker===id);

    const counts = d3.rollups(subset,v=>v.length,d=>d.emotion)
                     .reduce((m,[e,c])=>m.set(e,c), new Map());

    const data = EMOS.filter(e=>!hidden[e])
                     .map(e=>({emotion:e,count:counts.get(e)||0}));

    const pie = d3.pie().value(d=>d.count).sort(null);
    const arcZero=d3.arc().innerRadius(R*0.45).outerRadius(R)
                    ({startAngle:0,endAngle:0});

    /* slices */
    const slices = svg.selectAll("path.slice").data(pie(data),d=>d.data.emotion);
    slices.enter().append("path").attr("class","slice")
        .attr("fill",d=>COLORS(d.data.emotion))
        .attr("d",arcZero)
        .each(function(){this._current={startAngle:0,endAngle:0};})
        .on("mouseover",(e,d)=>tooltip.style("opacity",1)
             .html(`${EMO_LABEL[d.data.emotion]}: ${d.data.count}`)
             .style("left",`${e.pageX+12}px`).style("top",`${e.pageY-28}px`))
        .on("mousemove",e=>tooltip.style("left",`${e.pageX+12}px`).style("top",`${e.pageY-28}px`))
        .on("mouseout",()=>tooltip.style("opacity",0))
      .merge(slices)
        .transition().duration(800)
        .attrTween("d",function(d){
          const i=d3.interpolate(this._current,d);
          this._current=i(1);
          return t=>arc(i(t));
        });
    slices.exit().transition().duration(400)
        .attrTween("d",d=>{
          const i=d3.interpolate(d,{startAngle:0,endAngle:0});
          return t=>arc(i(t));
        }).remove();

    /* labels */
    const lbl = svg.selectAll("text.lbl").data(pie(data),d=>d.data.emotion);
    lbl.enter().append("text").attr("class","lbl").attr("text-anchor","middle")
        .attr("dy",".35em").style("font-size",".8rem").style("fill","#333")
      .merge(lbl)
        .transition().duration(800)
        .attr("transform",d=>{
          const [x,y]=arc.centroid(d);
          return `translate(${x*1.15},${y*1.15})`;
        })
        .text(d=>EMO_LABEL[d.data.emotion]);
    lbl.exit().remove();

    /* centre total */
    const total=d3.sum(data,d=>d.count);
    svg.selectAll("text.total").data([total])
       .join("text")
       .attr("class","total")
       .attr("text-anchor","middle")
       .style("font-size","1.8rem").style("font-weight",600)
       .attr("dy",".35em")
       .text(total);
  }

  /* ---------- REGISTER ---------- */
  window.__registerViz({id:"donut",title:"Emotion Donut",init,update:draw});

})();

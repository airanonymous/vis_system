/* temporal.js — robust state‑handling + full emotion labels  */

(() => {

    /* ---------------- CONSTANTS ---------------- */
    const FILE="iemocap_full_dataset_with_probs.csv";
    const EMOS=["ang","sad","hap","fru","neu","exc","sur","fea","dis"];
    const EMO_LABEL={
      ang:"Anger", sad:"Sadness", hap:"Happiness", fru:"Frustration",
      neu:"Neutral", exc:"Excitement", sur:"Surprise", fea:"Fear", dis:"Disgust"
    };
    const COLORS=d3.scaleOrdinal(EMOS,d3.schemeTableau10);

    const W=960,H=540,M={top:50,right:30,bottom:60,left:70},
          IW=W-M.left-M.right, IH=H-M.top-M.bottom,
          SMOOTH=9;

    /* ---------------- MODULE VARS ---------------- */
    let rows=[], svg,xS,yS,lineGen,areaGen,
        tooltip, sessionSel, pillSel, legendDiv, title;

    /* ---------------- INIT ---------------- */
    function init(container){
      const root=d3.select(container);

      title=root.append("h3").style("margin","0 0 10px");

      /* ─ Controls ─ */
      const ctrl=root.append("div")
        .style("display","flex").style("flex-wrap","wrap").style("gap","1rem")
        .style("margin-bottom","1rem");

      sessionSel = ctrl.append("label").text("Session: ")
        .append("select").on("change",draw);

      /* pill check‑boxes */
      const pillWrap=ctrl.append("div")
        .style("display","flex").style("flex-wrap","wrap").style("gap",".6rem");

      pillSel=pillWrap.selectAll("label").data(EMOS).enter().append("label")
        .style("padding",".25rem .65rem").style("border","1px solid #ccc")
        .style("border-radius","999px").style("font-size",".82rem")
        .style("cursor","pointer").style("display","inline-flex")
        .style("align-items","center")
        .each(function(code){
          d3.select(this)
            .append("input")
              .attr("type","checkbox").attr("value",code)
              .property("checked",["ang","neu"].includes(code))
              .style("margin-right",".3rem")
              .on("change",()=>{ stylePills(); draw(); });

          d3.select(this).append("span").text(EMO_LABEL[code]);
        });

      /* SVG scaffold */
      svg=root.append("svg").attr("width",W).attr("height",H)
           .append("g").attr("transform",`translate(${M.left},${M.top})`);

      xS=d3.scaleLinear().range([0,IW]);
      yS=d3.scaleLinear().range([IH,0]).domain([0,1]);

      lineGen=d3.line().curve(d3.curveCatmullRom)
                .x(d=>xS(d.idx)).y(d=>yS(d.prob));
      areaGen=d3.area().curve(d3.curveCatmullRom)
                .x(d=>xS(d.idx)).y0(IH).y1(d=>yS(d.prob));

      /* axes & labels */
      svg.append("g").attr("class","x-axis").attr("transform",`translate(0,${IH})`);
      svg.append("g").attr("class","y-axis");
      svg.append("text").attr("class","yLabel").attr("transform","rotate(-90)")
         .attr("x",-IH/2).attr("y",-M.left+20).attr("text-anchor","middle")
         .style("font-size",".9rem").text("Emotion Intensity");
      svg.append("text").attr("class","xLabel").attr("x",IW/2).attr("y",IH+44)
         .attr("text-anchor","middle").style("font-size",".9rem")
         .text("Progress of Session");

      /* grid layers */
      svg.append("g").attr("class","gridX");
      svg.append("g").attr("class","gridY");

      tooltip=d3.select("body").append("div").attr("class","tooltip");

      legendDiv=root.append("div").style("font-size",".8rem")
                   .style("display","flex").style("gap","1rem").style("margin",".6rem 0 0");

      /* ─ Load data ─ */
      d3.csv(FILE,d3.autoType).then(r=>{
        rows=r.map(d=>{
          const m=d.path.match(/Ses(\d{2})([FM])/);
          const id=m?`${m[2]}${m[1]}`:"UNK";
          const idx=d.method==="script"?1:2;
          d.sessionId=`${id}-session-${idx}`; return d;
        });

        const sessions=[...new Set(rows.map(d=>d.sessionId))].sort();
        sessionSel.selectAll("option").data(sessions).enter()
          .append("option").attr("value",d=>d).text(d=>d);
        sessionSel.property("value",sessions[0]);

        stylePills();
        draw();
      });
    }

    /* ---------------- Pill styling helper ---------------- */
    function stylePills(){
      pillSel.each(function(code){
        const checked=d3.select(this).select("input").property("checked");
        d3.select(this)
          .style("background",checked?COLORS(code)+"22":"#fff")
          .style("border-color",checked?COLORS(code):"#ccc")
          .style("color",checked?COLORS(code):"#000");
      });
    }

    /* ---------------- DRAW ---------------- */
    function draw(){
      if(!rows.length) return;

      const session=sessionSel.property("value");
      title.text(`Emotion Timeline — ${session}`);

      /* build active list reliably */
      const active=[];
      pillSel.each(function(code){
        if(d3.select(this).select("input").property("checked")) active.push(code);
      });

      if(active.length===0){
        svg.selectAll(".area,.line,.pt").remove();
        legendDiv.selectAll("*").remove();
        svg.select(".gridX").selectAll("*").remove();
        svg.select(".gridY").selectAll("*").remove();
        return;
      }

      /* prep data */
      const sessionData=rows.filter(d=>d.sessionId===session)
                            .sort((a,b)=>d3.ascending(a.path,b.path));
      sessionData.forEach((d,i)=>d.idx=i);

      xS.domain([0,sessionData.length-1]);

      svg.select(".x-axis").call(d3.axisBottom(xS).ticks(Math.min(10,sessionData.length)));
      svg.select(".y-axis").call(d3.axisLeft(yS).ticks(5));

      /* grid */
      svg.select(".gridX").call(g=>g
        .attr("transform",`translate(0,${IH})`)
        .call(d3.axisBottom(xS).ticks(10).tickSize(-IH).tickFormat(""))
        .selectAll("line").attr("stroke","#e0e0e0").attr("stroke-dasharray","2,2"));
      svg.select(".gridY").call(g=>g
        .call(d3.axisLeft(yS).ticks(5).tickSize(-IW).tickFormat(""))
        .selectAll("line").attr("stroke","#e0e0e0").attr("stroke-dasharray","2,2"));

      /* join per emotion */
      const emoG=svg.selectAll("g.emo").data(active,code=>code);
      const gEnter=emoG.enter().append("g").attr("class","emo");
      emoG.exit().remove();

      /* area */
      gEnter.append("path").attr("class","area")
            .attr("fill",c=>COLORS(c)).attr("fill-opacity",0.12);
      emoG.select(".area")
        .transition().duration(600)
        .attr("d",code=>areaGen(smooth(sessionData,code)));

      /* line */
      gEnter.append("path").attr("class","line")
            .attr("fill","none").attr("stroke-width",2)
            .attr("stroke",c=>COLORS(c))
            .on("mouseover",(_,c)=>highlight(c,true))
            .on("mouseout",(_,c)=>highlight(c,false));
      emoG.select(".line")
        .transition().duration(600)
        .attr("d",code=>lineGen(smooth(sessionData,code)));

      /* points */
      gEnter.append("g").attr("class","pt");
      emoG.select("g.pt").each(function(code){
        const g=d3.select(this);
        const pts=smooth(sessionData,code);
        const circ=g.selectAll("circle").data(pts);
        circ.enter().append("circle").attr("r",2.6).attr("fill",COLORS(code))
            .on("mouseover",(e,d)=>tooltip.style("opacity",1)
                 .html(`<strong>${EMO_LABEL[code]}</strong><br>utt ${d.idx}: ${d.prob.toFixed(3)}`)
                 .style("left",`${e.pageX+12}px`).style("top",`${e.pageY-28}px`))
            .on("mousemove",e=>tooltip.style("left",`${e.pageX+12}px`).style("top",`${e.pageY-28}px`))
            .on("mouseout",()=>tooltip.style("opacity",0))
          .merge(circ)
            .attr("cx",d=>xS(d.idx))
            .attr("cy",d=>yS(d.prob));
        circ.exit().remove();
      });

      /* legend */
      const leg=legendDiv.selectAll("span.item").data(active,code=>code);
      leg.enter().append("span").attr("class","item")
         .style("display","inline-flex").style("align-items","center").style("gap",".25rem")
         .style("cursor","pointer")
         .on("click",code=>{
           const chk=pillSel.filter(d=>d===code).select("input").node();
           chk.checked=!chk.checked; stylePills(); draw();
         })
         .html(code=>`<span style="width:12px;height:12px;background:${COLORS(code)};display:inline-block;border-radius:2px"></span>${EMO_LABEL[code]}`);
      leg.exit().remove();

      /* highlight helper */
      function highlight(code,on){
        svg.selectAll("path.line")
          .attr("stroke-opacity",d=>on&&(d!==code)?0.1:1)
          .attr("stroke-width",d=>on&&(d===code)?3:2);
        svg.selectAll("path.area")
          .attr("fill-opacity",d=>on&&(d!==code)?0.04:0.12);
      }
    }

    /* ---------- helpers ---------- */
    function smooth(arr,code){
      const raw=arr.map(r=>({idx:r.idx,prob:+r[`p_${code}`]}));
      return raw.map((d,i)=>{
        const s=Math.max(0,i-Math.floor(SMOOTH/2));
        const e=Math.min(raw.length-1,i+Math.floor(SMOOTH/2));
        return {idx:d.idx,prob:d3.mean(raw.slice(s,e+1),v=>v.prob)};
      });
    }

    /* ---------- register ---------- */
    window.__registerViz({id:"temporal",title:"Temporal Probabilities",init,update:draw});

  })();
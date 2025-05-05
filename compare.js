/* compare.js — scalable progress visual: radar + session‑timeline heat‑map
   DATA  : iemocap_probs_with_random_topics.csv
*/

(() => {

    /* ---------- CONFIG ---------- */
    const FILE="iemocap_probs_with_random_topics.csv";
    const EMOS=["ang","sad","hap","fru","neu","exc","sur","fea","dis"];
    const EMO_LABEL={
      ang:"Anger", sad:"Sadness", hap:"Happiness", fru:"Frustration",
      neu:"Neutral", exc:"Excitement", sur:"Surprise", fea:"Fear", dis:"Disgust"
    };
    const COL1="#4285F4", COL2="#FB8C00";   /* radar colours */

    const RAD_W=500, RAD_H=500, RAD_M=60;
    const HM_CELL=28, HM_M={top:40,right:20,bottom:40,left:120};
    const LEGEND_H=10, LEGEND_W=160;

    let rows=[], speakers=[], sessionsBySp={};
    let speakerSel, radarSvg, heatSvg, tooltip;

    /* ---------- INIT ---------- */
    function init(container){
      const hold=d3.select(container);

      hold.append("h3").text("Therapy Progress Across Sessions");
      hold.append("p").style("margin","-0.4rem 0 .6rem").style("font-size",".85rem")
          .style("color","#555")
          .text("Radar compares the first and most‑recent sessions. The heat‑map on the right tracks every session’s average emotion intensity.");

      /* legend for radar */
      hold.append("div").style("font-size",".8rem").html(`
         <span style="display:inline-flex;align-items:center;margin-right:14px;">
           <span style="width:12px;height:12px;background:${COL1};border-radius:2px;margin-right:4px;"></span>
           Session&nbsp;1
         </span>
         <span style="display:inline-flex;align-items:center;">
           <span style="width:12px;height:12px;background:${COL2};border-radius:2px;margin-right:4px;"></span>
           Latest&nbsp;Session
         </span>`);

      /* control */
      const ctrl=hold.append("div").style("margin","8px 0 16px")
                     .append("label").text("Speaker: ").append("select")
                     .on("change",draw);
      speakerSel=ctrl;

      /* left radar */
      radarSvg=hold.append("svg").attr("width",RAD_W).attr("height",RAD_H)
               .append("g").attr("transform",`translate(${RAD_W/2},${RAD_H/2})`);

      /* right heat‑map (created later after we know row count) */
      heatSvg=hold.append("svg");

      tooltip=d3.select("body").append("div").attr("class","tooltip");

      d3.csv(FILE,d3.autoType).then(r=>{
        rows=r;
        sessionsBySp=d3.rollups(rows,v=>[...new Set(v.map(d=>d.sessionId))].sort(),
                                d=>d.sessionId.split("-")[0])
                       .reduce((o,[k,v])=>(o[k]=v,o),{});
        speakers=Object.keys(sessionsBySp).sort();
        speakerSel.selectAll("option").data(speakers).enter()
          .append("option").attr("value",d=>d).text(d=>d);
        speakerSel.property("value",speakers[0]);
        draw();
      });
    }

    /* ---------- DRAW FULL VIS ---------- */
    function draw(){
      const sp=speakerSel.property("value");
      if(!sp) return;
      const sess=sessionsBySp[sp];
      const first=sess[0], last=sess[sess.length-1];

      const avg=sid=>{
        const sub=rows.filter(d=>d.sessionId===sid);
        const o={}; EMOS.forEach(e=>o[e]=d3.mean(sub,d=>+d[`p_${e}`]||0)); return o;
      };
      const avgFirst=avg(first), avgLast=avg(last);

      drawRadar(avgFirst,avgLast);
      drawHeatMap(sp,sess);
    }

    /* ---------- RADAR ---------- */
    function drawRadar(a1,a2){
      radarSvg.selectAll("*").remove();
      const radius=(RAD_W-RAD_M*2)/2;
      const step=2*Math.PI/EMOS.length;
      const max=d3.max([...Object.values(a1),...Object.values(a2)]);
      const r=d3.scaleLinear().domain([0,max]).range([0,radius]);

      /* grid */
      const rings=5;
      for(let i=1;i<=rings;i++)
        radarSvg.append("circle").attr("r",radius/rings*i)
          .attr("fill","none").attr("stroke","#ccc").attr("stroke-dasharray","2,2");

      EMOS.forEach((e,i)=>{
        const ang=i*step-Math.PI/2;
        radarSvg.append("text")
          .attr("x",(radius+12)*Math.cos(ang))
          .attr("y",(radius+12)*Math.sin(ang))
          .attr("text-anchor","middle")
          .attr("dominant-baseline","central")
          .style("font-size",".75rem").text(EMO_LABEL[e]);
      });

      const pts=vals=>EMOS.map((e,i)=>{
        const rr=r(vals[e]);
        return [rr*Math.cos(i*step-Math.PI/2), rr*Math.sin(i*step-Math.PI/2)];
      });

      radarSvg.append("polygon").attr("points",pts(a1).join(" "))
        .attr("fill",COL1).attr("fill-opacity",0.25)
        .attr("stroke",COL1).attr("stroke-width",2);
      radarSvg.append("polygon").attr("points",pts(a2).join(" "))
        .attr("fill",COL2).attr("fill-opacity",0.25)
        .attr("stroke",COL2).attr("stroke-width",2);
    }

    /* ---------- HEAT‑MAP ---------- */
    function drawHeatMap(sp,sessions){
      /* compute averages matrix sessions × emotions */
      const data=sessions.map(s=>{
        const sub=rows.filter(d=>d.sessionId===s);
        const obj={session:s};
        EMOS.forEach(e=>obj[e]=d3.mean(sub,d=>+d[`p_${e}`]||0)); return obj;
      });
      const max=d3.max(data.flatMap(d=>EMOS.map(e=>d[e])));

      const cell=HM_CELL;
      const H=HM_M.top+HM_M.bottom+cell*sessions.length;
      const W=HM_M.left+HM_M.right+cell*EMOS.length;

      heatSvg.attr("width",W).attr("height",H).selectAll("*").remove();
      const g=heatSvg.append("g").attr("transform",`translate(${HM_M.left},${HM_M.top})`);

      const x=d3.scaleBand().domain(EMOS).range([0,cell*EMOS.length]);
      const y=d3.scaleBand().domain(sessions).range([0,cell*sessions.length]);

      const color=d3.scaleSequential(d3.interpolateYlOrRd).domain([0,max]);

      /* cells */
      g.selectAll("rect").data(data.flatMap(d=>EMOS.map(e=>({session:d.session, emo:e, val:d[e]}))))
        .enter().append("rect")
          .attr("x",d=>x(d.emo)).attr("y",d=>y(d.session))
          .attr("width",cell).attr("height",cell)
          .attr("fill",d=>color(d.val))
          .on("mousemove",(ev,d)=>tooltip.style("opacity",1)
              .html(`${d.session}<br>${EMO_LABEL[d.emo]}: ${d.val.toFixed(2)}`)
              .style("left",`${ev.pageX+12}px`).style("top",`${ev.pageY-28}px`))
          .on("mouseout",()=>tooltip.style("opacity",0));

      /* axes labels */
      g.append("g").attr("transform",`translate(0,${y.range()[1]})`)
         .call(d3.axisBottom(x).tickFormat(e=>EMO_LABEL[e]).tickSize(0))
         .selectAll("text").style("font-size",".7rem").style("text-anchor","start")
           .attr("transform","rotate(40)");
      g.append("g")
         .call(d3.axisLeft(y).tickSize(0))
         .selectAll("text").style("font-size",".75rem");

      /* colour legend */
      const lg=g.append("g").attr("transform",`translate(${x.range()[1]-LEGEND_W},${-HM_M.top/1.5})`);
      const gradient=heatSvg.append("defs").append("linearGradient")
          .attr("id","grad").attr("x1","0%").attr("x2","100%");
      gradient.append("stop").attr("offset","0%").attr("stop-color",color(0));
      gradient.append("stop").attr("offset","100%").attr("stop-color",color(max));

      lg.append("rect").attr("width",LEGEND_W).attr("height",LEGEND_H)
        .attr("fill","url(#grad)");
      lg.append("text").attr("x",0).attr("y",-4).style("font-size",".7rem").text("Low");
      lg.append("text").attr("x",LEGEND_W).attr("y",-4)
        .attr("text-anchor","end").style("font-size",".7rem").text("High");
    }

    /* ---------- register ---------- */
    window.__registerViz({id:"compare",title:"Therapy Progress",init,update:draw});

    })();
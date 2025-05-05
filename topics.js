/* topics.js — topic streams + brush‑to‑donut + readable emotion labels */

(() => {

  /* ---------- CONFIG ---------- */
  const FILE  = "iemocap_probs_with_random_topics.csv";
  const EMOS  = ["ang","sad","hap","fru","neu","exc","sur","fea","dis"];
  const EMO_LABELS = {                      // ❶ user‑friendly names
    ang:"Anger", sad:"Sadness", hap:"Happiness", fru:"Frustration",
    neu:"Neutral", exc:"Excitement", sur:"Surprise", fea:"Fear", dis:"Disappointment"
  };
  const MAX_TOPICS = 5;
  const WIN   = 15;
  const COLORS = d3.schemeTableau10.concat(d3.schemeSet3);
  const COLOR_LINE = "#222";

  const W=960, H_STREAM=420, H_DONUT=320,
        M={top:55,right:70,bottom:55,left:70},
        IW=W-M.left-M.right, IH=H_STREAM-M.top-M.bottom;

  let rows=[], topics=[], topicColor, hidden=new Set();
  let x,yTopic,yLine,area,line;
  let sessionSel, emoSel, legendDiv, tooltip;
  let streamSvg, donutSvg, donutHolder;

  /* ---------- INIT ---------- */
  function init(container){

    const holder=d3.select(container);

    /* header text */
    holder.append("h3").text("Topic Streams & Emotion Intensity");
    holder.append("p").style("margin-top","-0.5rem").style("font-size",".88rem")
      .text("Coloured rivers show how conversation topics rise and fall. "
           +"The dark line tracks the selected emotion’s intensity.");
    holder.append("p").style("margin-top","-0.8rem").style("font-size",".78rem")
      .style("color","#555")
      .text("Brush a time‑slice to reveal a donut of topic share. Only the visible topics participate.");

    /* controls */
    const ctrl=holder.append("div")
      .style("display","flex").style("flex-wrap","wrap").style("gap","1rem")
      .style("margin-bottom","1rem");

    sessionSel = ctrl.append("label").text("Session: ")
                     .append("select").on("change",drawStream);

    emoSel = ctrl.append("label").text("Emotion overlay: ")
                 .append("select").on("change",drawStream);

    emoSel.selectAll("option").data(EMOS).enter()       /* ❷ readable labels */
      .append("option")
        .attr("value",d=>d)
        .text(d=>EMO_LABELS[d]);

    emoSel.property("value","ang");

    /* stream svg */
    streamSvg=holder.append("svg").attr("width",W).attr("height",H_STREAM);
    const g=streamSvg.append("g").attr("transform",`translate(${M.left},${M.top})`);

    x=d3.scaleLinear().range([0,IW]);
    yTopic=d3.scaleLinear().range([IH,0]);
    yLine =d3.scaleLinear().range([IH,0]);

    area=d3.area().curve(d3.curveBasis)
      .x((d,i)=>x(i)).y0(d=>yTopic(d[0])).y1(d=>yTopic(d[1]));
    line=d3.line().curve(d3.curveBasis)
      .x(d=>x(d.idx)).y(d=>yLine(d.prob));

    g.append("g").attr("class","x-axis").attr("transform",`translate(0,${IH})`);
    g.append("g").attr("class","y-axis-left");
    g.append("g").attr("class","y-axis-right").attr("transform",`translate(${IW},0)`);

    g.append("text").attr("class","yLab").attr("transform","rotate(-90)")
      .attr("x",-IH/2).attr("y",-M.left+15).attr("text-anchor","middle")
      .style("font-size",".85rem").text("Topic Share (smoothed)");
    g.append("text").attr("class","yLabR")
      .attr("transform",`translate(${IW+45},${IH/2}) rotate(-90)`)
      .attr("text-anchor","middle").style("font-size",".85rem")
      .text("Emotion Intensity");
    g.append("text").attr("class","xLab")
      .attr("x",IW/2).attr("y",IH+35).attr("text-anchor","middle")
      .style("font-size",".85rem").text("Progress of Session (utterance index)");

    const brush = d3.brushX().extent([[0,0],[IW,IH]]).on("end",brushEnded);
    g.append("g").attr("class","brush").call(brush);

    legendDiv=holder.append("div").style("margin","8px 0");
    tooltip  =d3.select("body").append("div").attr("class","tooltip");

    /* donut */
    donutHolder=holder.append("div").style("display","none");
    donutHolder.append("h4").text("Topic share in brushed slice")
               .style("margin","6px 0 2px");
    donutSvg=donutHolder.append("svg").attr("width",W).attr("height",H_DONUT)
             .append("g").attr("transform",`translate(${W/2},${H_DONUT/2})`);

    /* load data */
    d3.csv(FILE,d3.autoType).then(raw=>{
      rows=raw;

      const freq=d3.rollups(rows,v=>v.length,d=>d.topic)
                   .sort((a,b)=>d3.descending(a[1],b[1]));
      topics=freq.slice(0,MAX_TOPICS).map(d=>d[0]);
      if(freq.length>MAX_TOPICS) topics.push("Other");
      rows.forEach(d=>{ if(!topics.includes(d.topic)) d.topic="Other"; });

      topicColor=d3.scaleOrdinal(topics, COLORS.slice(0,topics.length));

      const sessions=Array.from(new Set(rows.map(d=>d.sessionId))).sort();
      sessionSel.selectAll("option").data(sessions).enter()
        .append("option").attr("value",d=>d).text(d=>d);
      sessionSel.property("value",sessions[0]);

      buildLegendTwoRandom();
      drawStream();
    });
  }

  /* ---------- Legend (no text fade) ---------- */
  function buildLegendTwoRandom(){
    legendDiv.selectAll("*").remove();

    const shown = d3.shuffle(topics.slice()).slice(0,2);
    hidden = new Set(topics.filter(t=>!shown.includes(t)));

    const row=legendDiv.selectAll("span").data(topics).enter().append("span")
      .style("display","inline-flex").style("align-items","center")
      .style("gap",".25rem").style("margin-right","10px").style("cursor","pointer")
      .on("click",(_,t)=>toggle(t));

    row.append("input").attr("type","checkbox")
        .property("checked",t=>!hidden.has(t))
        .on("click",(e,t)=>{ e.stopPropagation(); toggle(t); });

    row.append("span").style("width","12px").style("height","12px")
        .style("border-radius","3px").style("background",t=>topicColor(t));
    row.append("span").style("font-size",".8rem").text(t=>t);

    function toggle(t){ hidden.has(t)?hidden.delete(t):hidden.add(t); drawStream(); }
  }

  /* ---------- DRAW STREAM ---------- */
  function drawStream(){
    if(rows.length===0) return;

    const sess=sessionSel.property("value");
    const emo = emoSel.property("value");

    const utt=rows.filter(d=>d.sessionId===sess).sort((a,b)=>d3.ascending(a.utt_idx,b.utt_idx));
    utt.forEach((d,i)=>d.idx=i);
    x.domain([0,utt.length-1]);

    /* topic stack */
    const idxMap=new Map(topics.map((t,i)=>[t,i]));
    const base=topics.map(()=>new Array(utt.length).fill(0));
    utt.forEach((d,i)=>{ if(!hidden.has(d.topic)) base[idxMap.get(d.topic)][i]=1; });
    const smooth=base.map(a=>movAvg(a,WIN));
    const stacked=d3.stack().keys(d3.range(topics.length))(d3.transpose(smooth));

    yTopic.domain([0,d3.max(stacked,lay=>d3.max(lay,d=>d[1]))||1]);
    yLine .domain([0,d3.max(utt,d=>+d[`p_${emo}`])||1]);

    const g=streamSvg.select("g");

    const layers=g.selectAll("path.layer").data(stacked,(_,i)=>topics[i]);
    layers.enter().append("path").attr("class","layer")
        .attr("fill",(_,i)=>topicColor(topics[i])).attr("opacity",0.85)
      .merge(layers).transition().duration(600).attr("d",area);
    layers.exit().remove();

    /* black line */
    const lineData=utt.map(u=>({idx:u.idx,prob:+u[`p_${emo}`]}));
    const overlay=g.selectAll("path.overlay").data([lineData]);
    overlay.enter().append("path").attr("class","overlay")
        .attr("fill","none").attr("stroke",COLOR_LINE).attr("stroke-width",2)
      .merge(overlay).transition().duration(600)
        .attr("d",line(smoothLine(lineData,WIN)));
    overlay.exit().remove();

    /* axes */
    g.select(".x-axis").call(d3.axisBottom(x).ticks(Math.min(10,utt.length)));
    g.select(".y-axis-left").call(d3.axisLeft(yTopic).ticks(4));
    g.select(".y-axis-right").call(d3.axisRight(yLine).ticks(4));

    legendDiv.selectAll("input").property("checked",t=>!hidden.has(t));

    donutHolder.style("display","none");
  }

  /* ---------- BRUSH ---------- */
  function brushEnded({selection}){
    if(!selection){ donutHolder.style("display","none"); return; }
    const [x0,x1]=selection.map(x.invert);
    const sess=sessionSel.property("value");
    const slice=rows.filter(d=>d.sessionId===sess && d.utt_idx>=x0 && d.utt_idx<=x1);
    drawDonut(slice);
  }

  /* ---------- DONUT ---------- */
  function drawDonut(slice){
    donutSvg.selectAll("*").remove();
    if(slice.length===0){ donutHolder.style("display","none"); return; }

    const active=topics.filter(t=>!hidden.has(t));
    const data=active.map(t=>({
      topic:t, count:slice.filter(d=>d.topic===t).length
    })).filter(d=>d.count>0);
    const total=d3.sum(data,d=>d.count);
    if(total===0){ donutHolder.style("display","none"); return; }

    donutHolder.style("display","block");

    const pie=d3.pie().value(d=>d.count);
    const r=110, arc=d3.arc().innerRadius(r*0.5).outerRadius(r);

    donutSvg.selectAll("path").data(pie(data)).enter().append("path")
      .attr("d",arc).attr("fill",d=>topicColor(d.data.topic))
      .on("mousemove",(e,d)=>tooltip.style("opacity",1)
           .html(`${d.data.topic}: ${(d.data.count/total*100).toFixed(1)}%`)
           .style("left",`${e.pageX+12}px`).style("top",`${e.pageY-28}px`))
      .on("mouseout",()=>tooltip.style("opacity",0));

    donutSvg.append("text").attr("text-anchor","middle").attr("dy",".35em")
      .style("font-size","1rem").style("font-weight",600)
      .text(total+" utt");
  }

  /* ---------- HELPERS ---------- */
  const movAvg =(arr,w)=>arr.map((_,i)=>d3.mean(arr.slice(Math.max(0,i-w/2|0),Math.min(arr.length,i+w/2|0)+1)));
  const smoothLine=(arr,w)=>arr.map((d,i)=>({
    idx:d.idx,
    prob:d3.mean(arr.slice(Math.max(0,i-w/2|0),Math.min(arr.length-1,i+w/2|0)+1),v=>v.prob)
  }));

  /* ---------- REGISTER ---------- */
  window.__registerViz({
    id:"context",
    title:"Topic–Emotion Correlation",
    init,
    update:drawStream
  });

})();
/* temporal_fixed.js — immediate rendering with D3 join, no stale state */

(() => {
    /* ---------------- CONSTANTS ---------------- */
    const FILE = "iemocap_full_dataset_with_probs.csv";
    const EMOS = ["ang","sad","hap","fru","neu","exc","sur","fea","dis"];
    const EMO_LABEL = {
      ang: "Anger", sad: "Sadness", hap: "Happiness", fru: "Frustration",
      neu: "Neutral", exc: "Excitement", sur: "Surprise", fea: "Fear", dis: "Disgust"
    };
    const COLORS = d3.scaleOrdinal(EMOS, d3.schemeTableau10);

    const W = 960, H = 540, M = {top:50,right:30,bottom:60,left:70},
          IW = W-M.left-M.right, IH = H-M.top-M.bottom,
          SMOOTH = 9;

    /* ---------------- MODULE VARS ---------------- */
    let rows = [],
        svg, xS, yS, lineGen, areaGen,
        tooltip, sessionSel, pillSel, legendDiv, title;

    // ← our single source of truth for what’s checked
    const activeEmotions = new Set(["ang","neu"]);

    /* ---------------- INIT ---------------- */
    function init(container) {
      const root = d3.select(container);

      title = root.append("h3").style("margin","0 0 10px");

      /* Controls */
      const ctrl = root.append("div")
        .style("display","flex")
        .style("flex-wrap","wrap")
        .style("gap","1rem")
        .style("margin-bottom","1rem");

      sessionSel = ctrl.append("label").text("Session: ")
        .append("select").on("change", draw);

      /* emotion pills */
      const pillWrap = ctrl.append("div")
        .style("display","flex")
        .style("flex-wrap","wrap")
        .style("gap",".6rem");

      pillSel = pillWrap.selectAll("label")
         .data(EMOS)
        .enter().append("label")
         .style("padding",".25rem .65rem")
         .style("border","1px solid #ccc")
         .style("border-radius","999px")
         .style("font-size",".82rem")
         .style("cursor","pointer")
         .style("display","inline-flex")
         .style("align-items","center")
        .each(function(code) {
          const thatLabel = d3.select(this);

          // checkbox
          thatLabel.append("input")
            .attr("type", "checkbox")
            .attr("value", code)
            .classed("emo-checkbox", true)
            .property("checked", activeEmotions.has(code))
            .style("margin-right",".3rem")
            .on("change", function() {
              // toggle in our Set
              if (this.checked) activeEmotions.add(code);
              else              activeEmotions.delete(code);
              stylePills();
              draw();
            });

          // text
          thatLabel.append("span").text(EMO_LABEL[code]);
        });

      /* SVG scaffold */
      svg = root.append("svg")
         .attr("width", W).attr("height", H)
        .append("g")
         .attr("transform", `translate(${M.left},${M.top})`);

      xS = d3.scaleLinear().range([0,IW]);
      yS = d3.scaleLinear().range([IH,0]).domain([0,1]);

      lineGen = d3.line().curve(d3.curveCatmullRom)
                .x(d=>xS(d.idx)).y(d=>yS(d.prob));
      areaGen = d3.area().curve(d3.curveCatmullRom)
                .x(d=>xS(d.idx)).y0(IH).y1(d=>yS(d.prob));

      /* axes & labels */
      svg.append("g").attr("class","x-axis").attr("transform",`translate(0,${IH})`);
      svg.append("g").attr("class","y-axis");
      svg.append("text").attr("class","yLabel")
         .attr("transform","rotate(-90)")
         .attr("x",-IH/2).attr("y",-M.left+20)
         .attr("text-anchor","middle")
         .style("font-size",".9rem")
         .text("Emotion Intensity");
      svg.append("text").attr("class","xLabel")
         .attr("x",IW/2).attr("y",IH+44)
         .attr("text-anchor","middle")
         .style("font-size",".9rem")
         .text("Progress of Session");

      /* grid layers */
      svg.append("g").attr("class","gridX");
      svg.append("g").attr("class","gridY");

      tooltip = d3.select("body").append("div").attr("class","tooltip");
      legendDiv = root.append("div")
        .style("font-size",".8rem")
        .style("display","flex")
        .style("gap","1rem")
        .style("margin",".6rem 0 0");

      /* load data */
      d3.csv(FILE, d3.autoType).then(data => {
        rows = data.map(d => {
          const m = d.path.match(/Ses(\d{2})([FM])/);
          const id = m ? `${m[2]}${m[1]}` : "UNK";
          const idx = d.method==="script" ? 1 : 2;
          d.sessionId = `${id}-session-${idx}`;
          return d;
        });

        const sessions = [...new Set(rows.map(d=>d.sessionId))].sort();
        sessionSel.selectAll("option")
          .data(sessions)
         .enter().append("option")
          .attr("value", d=>d).text(d=>d);

        sessionSel.property("value", sessions[0]);
        stylePills();
        draw();
      });
    }

    /* style pills based on Set */
    function stylePills(){
      pillSel.each(function(code){
        const label = d3.select(this);
        const isOn  = activeEmotions.has(code);
        label
          .style("background",    isOn ? COLORS(code)+"22" : "#fff")
          .style("border-color",  isOn ? COLORS(code)      : "#ccc")
          .style("color",         isOn ? COLORS(code)      : "#000");
        label.select("input").property("checked", isOn);
      });
    }

    /* draw uses the Set directly */
    function draw(){
      if (!rows.length) return;

      // Interrupt any in‑flight transitions so that new state is applied immediately
      svg.selectAll("*"                    ).interrupt();

      const session = sessionSel.property("value");
      title.text(`Emotion Timeline — ${session}`);

      const active = Array.from(activeEmotions);
      if (active.length === 0) {
        svg.selectAll("g.emo, .gridX > *, .gridY > *").remove();
        legendDiv.selectAll("*").remove();
        return;
      }

      // prep data
      const sessionData = rows
        .filter(d => d.sessionId === session)
        .sort((a,b)=>d3.ascending(a.path,b.path))
        .map((d,i)=>({ ...d, idx:i }));

      xS.domain([0, sessionData.length - 1]);
      svg.select(".x-axis")
         .call(d3.axisBottom(xS).ticks(Math.min(10,sessionData.length)));
      svg.select(".y-axis")
         .call(d3.axisLeft(yS).ticks(5));

      // grid lines
      svg.select(".gridX")
        .attr("transform",`translate(0,${IH})`)
        .call(g=>g.selectAll("* ").remove())
        .call(g=>g.call(d3.axisBottom(xS).ticks(10).tickSize(-IH).tickFormat("")))
        .selectAll("line").attr("stroke","#e0e0e0").attr("stroke-dasharray","2,2");
      svg.select(".gridY")
        .call(g=>g.selectAll("*").remove())
        .call(g=>g.call(d3.axisLeft(yS).ticks(5).tickSize(-IW).tickFormat("")))
        .selectAll("line").attr("stroke","#e0e0e0").attr("stroke-dasharray","2,2");

      /* ---- MAIN JOIN ---- */
      const emoG = svg.selectAll("g.emo").data(active, c=>c).join(
        enter => {
          const g = enter.append("g").attr("class","emo");
          g.append("path")
            .attr("class","area")
            .attr("fill", c=>COLORS(c))
            .attr("fill-opacity",0.12);
          g.append("path")
            .attr("class","line")
            .attr("fill","none")
            .attr("stroke-width",2)
            .attr("stroke", c=>COLORS(c))
            .on("mouseover", (_,c)=>highlight(c,true))
            .on("mouseout",  (_,c)=>highlight(c,false));
          g.append("g").attr("class","pt");
          return g;
        },
        update => update,
        exit   => exit.remove()
      );

      // area + line paths (no transition; immediate)
      emoG.select("path.area")
          .attr("d", c=>areaGen(smooth(sessionData,c)));
      emoG.select("path.line")
          .attr("d", c=>lineGen(smooth(sessionData,c)));

      // update points
      emoG.select("g.pt").each(function(code){
        const g = d3.select(this);
        const pts = smooth(sessionData, code);
        const circ = g.selectAll("circle").data(pts);
        circ.enter().append("circle")
            .attr("r",2.6).attr("fill", COLORS(code))
            .on("mouseover",(e,d)=>tooltip.style("opacity",1)
                 .html(`<strong>${EMO_LABEL[code]}</strong><br>utt ${d.idx}: ${d.prob.toFixed(3)}`)
                 .style("left",`${e.pageX+12}px`).style("top",`${e.pageY-28}px`))
            .on("mousemove",e=>tooltip.style("left",`${e.pageX+12}px`).style("top",`${e.pageY-28}px`))
            .on("mouseout",()=>tooltip.style("opacity",0))
          .merge(circ)
            .attr("cx", d=>xS(d.idx))
            .attr("cy", d=>yS(d.prob));
        circ.exit().remove();
      });

      // legend
      const leg = legendDiv.selectAll("span.item").data(active, c=>c).join(
        enter => enter.append("span").attr("class","item")
           .style("display","inline-flex")
           .style("align-items","center")
           .style("gap",".25rem")
           .style("cursor","pointer")
           .on("click", code=>{
             if (activeEmotions.has(code)) activeEmotions.delete(code);
             else                           activeEmotions.add(code);
             stylePills();
             draw();
           })
           .html(c=>`<span style="width:12px;height:12px;background:${COLORS(c)};display:inline-block;border-radius:2px"></span> ${EMO_LABEL[c]}`),
        update => update,
        exit   => exit.remove()
      );

      function highlight(code,on){
        svg.selectAll("path.line")
          .attr("stroke-opacity", d=>on && d!==code ? 0.1 : 1)
          .attr("stroke-width",   d=>on && d===code ? 3   : 2);
        svg.selectAll("path.area")
          .attr("fill-opacity", d=>on && d!==code ? 0.04 : 0.12);
      }
    }

    /* smoothing helper */
    function smooth(arr,code){
      const raw = arr.map(r=>({idx:r.idx,prob:+r[`p_${code}`]}));
      return raw.map((d,i)=>{
        const s = Math.max(0,i-Math.floor(SMOOTH/2)),
              e = Math.min(raw.length-1,i+Math.floor(SMOOTH/2));
        return {idx:d.idx,prob:d3.mean(raw.slice(s,e+1),v=>v.prob)};
      });
    }

    /* register */
    window.__registerViz({
      id: "temporal-fixed",
      title: "Temporal Probabilities",
      init,
      update: draw
    });

  })();

/* app.js — creates a tab + holder for every registered visualisation */

(() => {
    const registry = [];                   // [{id,title,init,update,container}]
    const tabsBar  = d3.select("#vis-tabs");
    const main     = d3.select("#vis-container");

    window.__registerViz = function(v){
      registry.push(v);
      // holder
      v.container = main.append("div")
        .attr("id",v.id+"-holder")
        .attr("class","vis-block");
      // tab
      tabsBar.append("div")
        .attr("class","tab")
        .attr("data-id",v.id)
        .text(v.title)
        .on("click",()=>activate(v.id));
      // init now
      v.init(v.container.node());
      // activate first tab automatically
      if(registry.length===1) activate(v.id);
    };

    function activate(id){
      tabsBar.selectAll(".tab").classed("active",function(){return this.dataset.id===id});
      main.selectAll(".vis-block").classed("active",function(){return this.id===id+"-holder"});
      const v = registry.find(r=>r.id===id);
      if(v) v.update();                    // update only the active vis
    }
  })();
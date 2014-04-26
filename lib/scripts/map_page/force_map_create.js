// javascript to set up the initial appearance of the force map on the Map tab

// iframe heights for search and related result pages
// physical screen height - (browser window real estate) - top tabs height - allowance for scroll bar.
var googleIFrameHeight = Math.min(window.screen.height, 1024) - (window.outerHeight - window.innerHeight) - 
                         $("ul#topTabs").outerHeight() - 30;

// forcePatent and forceBiblio map calculation space (somewhat arbitrary)
var fMap = {
  "w": 1000,
  "h": 550,
  "minDate": new Date("1976-01-01"),
  "maxDate": new Date("2014-07-01"),
  "alpha": 0.1
};

// div.force-container parameters; if css for div.force-container changes, these parameters must be updated manually
var fCont = {
  "padding" : {"top": 0, "bottom": 0, "left": 0, "right": 0},
  "border" : {"top": 14, "bottom": 14, "left": 14, "right": 14},
  "margin" : {"top": 0, "bottom": 0, "left": 2, "right": 2}
}
fCont.totH = fCont.padding.left + fCont.padding.right + fCont.border.right + fCont.border.left
                     + fCont.margin.left + fCont.margin.right;
fCont.totV = fCont.padding.top + fCont.padding.bottom + fCont.border.top + fCont.border.bottom
                     + fCont.margin.top + fCont.margin.bottom;

// div.patent-list parameters; if css for div.patent-list changes, these parameters must be updated manually
var pList = {
  "w" : 350,                                         // width is 350 px
  "padding" : {"top": 0, "bottom": 0, "left": 0, "right": 0},
  "border" : {"top": 2, "bottom": 2, "left": 2, "right": 2},
  "margin" : {"top": 0, "bottom": 5, "left": 0, "right": 0}
}
pList.totW = pList.w + pList.padding.left + pList.padding.right + pList.border.right + pList.border.left
                     + pList.margin.left + pList.margin.right;

// svg.main-svg parameters
var svgP = {
  // physical screen width - (browser window real estate) - total width of patent lists - force container horizontal
  // boundary overhead - allowance for scroll bar.
  "w" : Math.min(window.screen.width, 1280) - (window.outerWidth - window.innerWidth) - pList.totW -
                 fCont.totH - 25,                                                                     // was 960

  // physical screen height - (browser window real estate) - div.main-content offset relative to document -
  // force container vertical boundary overhead - allowance for scroll bar.
  "h" : Math.min(window.screen.height, 1024) - (window.outerHeight - window.innerHeight) - 
                 $("div.main-content").offset().top - fCont.totV - 30,                                // was 600
  // need large margins to accomodate mouse dragging of nodes behind biblio divs
  "margin" : {"top": 18, "bottom" : 35, "left": 18, "right": 18},
  "nodeLegend": {
         "w": 120 + 8,                               // 120px for the legend and 8 px for the bounding box
         "h": 100,
         "margin": {"top": 10, "bottom" : 10, "left": 10, "right": 5}
  }
};

// div.top-force-container parameters; same width as div.force-container width + padding + borders
var topfCont = {
  "w" : svgP.w + fCont.border.left + fCont.border.right + fCont.padding.left + fCont.padding.right
}
$("div.top-force-container").css("width", topfCont.w + "px");

var plotSize = {                                     // set width, height of force map plot area
  "w": svgP.w - svgP.margin.left - svgP.margin.right,
  "h": svgP.h - svgP.margin.top - svgP.margin.bottom
}

var bibConP = {                                      // set width, height of div.bib-container
  "w": plotSize.w + 1,
  "h": plotSize.h + 1
};

var pState = {                                       // track the state of the plot
  "zMin": 0,                                         // for tracking the css z-index of biblios
  "zMax": 0,
  "mouse" : "normal",                                // mouse events on biblios behave "normal" or "transparent"
  "shiftKey": false,                                 // tracks whether shift key is pressed
  "transformTime": 0.7,                              // CSS transition parameters when biblios are unpinned
  "opacityTime": 0.3,
  "transition": 0                                    // number of biblios that are transitioning after being unpinned
}

// legend color palette (from Cynthia Brewer - see d3js documentation on colorbrewer)
var legendColors = ['rgb(141,211,199)','rgb(255,255,179)','rgb(190,186,218)','rgb(251,128,114)','rgb(128,177,211)',
                    'rgb(253,180,98)', 'rgb(179,222,105)','rgb(252,205,229)','rgb(217,217,217)','rgb(188,128,189)',
                    'rgb(204,235,197)','rgb(255,237,111)']

// create div container element for the short biblio popovers; overlays the forcePatent map svg content;
// need to add 1px to plotSize.w and plotSize.h so the bib-container completely masks the force plot at the
// right and bottom edges if pointer-events are enabled on the bib-container to block mouse events
// from reaching the force map.
var bib = d3.select("#Map").select("div.bib-container")
            .style({"width": bibConP.w + "px", "height": bibConP.h + "px",
                    "margin-top": svgP.margin.top + "px", "margin-bottom": svgP.margin.bottom + "px",
                    "margin-left": svgP.margin.left + "px", "margin-right": svgP.margin.right + "px"});

// create the main svg element and attach mouse event handlers that will control when biblio pop-ups disappear
// and allow mouse events to go through biblio pop-ups
var svg_main = d3.select("#Map").select("svg.main-svg").attr({"width": svgP.w, "height": svgP.h});

// create g container element to contain the graphics; note var svg is actually the g element child of the
// svg document element; appends to svg will be children of the g element
var svg = svg_main.append("svg:g").attr("transform", "translate(" + svgP.margin.left + "," + svgP.margin.top + ")")

// create a clipping region for the force map; does not actually clip anything until it is applied to a particular
// graphics element via the clip-path attribute; apply to plot data, but not to axes
svg.append("svg:clipPath").attr({"id": "clip"})
                          .append("svg:rect").attr({"width": plotSize.w, "height": plotSize.h});

// create a clipping region for the mapped patent markers. (Append it here to avoid multiple copies for each marker)
svg.append("svg:clipPath").attr({"id": "nodeClip"})
                          .append("svg:circle").attr({"id": "nodeMarker", "r": 7.5});

// add the x-axis label SVG elements
var xAxisLabelSVG = svg.append("g").classed({"x-axis-label": true})
                       .attr({"transform": "translate(0," + plotSize.h +")"}); // create x axis label SVG elements

// add x axis gridline SVG; override default stroke:white, fill:black
var xAxisGridSVG = svg.append("g").classed({"x-axis-grid": true})
                       .attr({"transform": "translate(0,0)"})
                       .style({"stroke": "lightgray", "fill": "transparent"});

// container to process zoom events; is the target of mouse events when biblios are transparent to mouse events
var zoom_rect = svg.append("svg:rect").attr({"class": "zoom-pane", "width": plotSize.w, "height": plotSize.h});

// create g container for the plot elements that will be clipped; plot elements will be drawn last so they are the
// first to receive events
var plot = svg.append("svg:g").classed({"force-plot": true}).attr({"clip-path": "url(#clip)"});

// create the company legend container; place after the force plot, so legends will be on top
var legend = svg.append("svg:g").classed({"legend": true}).attr({"transform": "translate(20, 18)"});

// create the node legend container and use d3js to construct it using createNodeLegend
var nodeLegend = svg.append("svg:g").classed({"node-legend-container": true})
        .attr({"transform": "translate(" + (plotSize.w - svgP.nodeLegend.w - svgP.nodeLegend.margin.right) +  ",9)"});
createNodeLegend();                                              // add the SVG

var patentMapPlot = new PatentMapPlot(fMap, plotSize);

function PatentMapPlot(fMap, plotSize) {
// fMap object contains basic force map dimensions; plotSize object contains basic plot dimensions;
// initialize plotting and map display parameters
  this.pParam = {};
  // x-axis scale for force map
  this.xForceScale = d3.time.scale().domain([fMap.minDate, fMap.maxDate]).range([0, fMap.w]);
  this.xPlotScale = d3.time.scale().range([0, plotSize.w]);      // x-axis scaling: x date scale to pixels for plotting
  this.yPlotScale = d3.scale.linear().range([0, plotSize.h]);    // y-axis scaling: y scale to pixels for plotting
  // transform x and y force map to x and y plotting; the .domain never changes, but .range is updated
  // in updateForceScaling below
  this.xForceToPlotScale = d3.scale.linear().domain([this.xForceScale(fMap.minDate), this.xForceScale(fMap.maxDate)]);
  this.yForceToPlotScale = d3.scale.linear().domain([0, fMap.h]);

  // create two d3 x axes: one for just for the labels...
  this.xAxisLabel = d3.svg.axis().orient("bottom").tickPadding(4).tickSize(2).scale(this.xPlotScale);
  // and the other just for the gridlines
  this.xAxisGrid = d3.svg.axis().orient("bottom").tickPadding(0).innerTickSize(plotSize.h).outerTickSize(0)
                        .scale(this.xPlotScale);

  this.initialize = function() {
    this.initializeParam();
    this.initializeAxes();
    legendColors = _.shuffle(legendColors);              // new palette of legend colors
    setPlotState("normal");
  }

  this.initializeParam = function() {
    this.pParam = {
      "minDate": undefined,                              // min, max based on patent data
      "maxDate": undefined,
      "minX": undefined,                                 // min, max of the x (filing date) axis
      "maxX": undefined,
      "minY": 0,
      "maxY": fMap.h,
      "scale": 1,
      "panTransY": 0,                    // need to track the panning and zooming contributions to the y translation reported
      "zoomTransY": 0                                   // by d3 zoom.translation()
    };
  }

  this.initializeAxes = function() {
    this.updateXPlotScaling();
    this.updateYPlotScaling();
    this.updateForceScaling();
  }

  this.updateXPlotScaling = function() {
  // update domain of this.xPlotScale, based on new values in this.pParam; domain is patent filing date;
  // range is pixel coordinates for plotting; called from this.initializeAxes and this.updateXAxis limits.
    this.xPlotScale.domain([this.pParam.minX, this.pParam.maxX]);
  }

  this.updateYPlotScaling = function() {
  // redefine domain of  the yPlotScale, based on new values in this.pParam; domain is y-axis scale and
  // range is pixel coordinates for plotting; called from this.initializeAxes.
    this.yPlotScale.domain([this.pParam.minY, this.pParam.maxY]);
  }

  this.updateYPlotZoomScaling = function() {
  // redefine domain of  the yPlotScale after panning in a zoom based on new values in this.pParam
  // domain is y-axis scale; range is pixel coordinates for plotting; called from this.on_zoom.
    this.yPlotScale.domain([this.pParam.minY - this.pParam.panTransY, this.pParam.maxY - this.pParam.panTransY]);
  }

  this.updateForceScaling = function() {
  // update the x- and y-axis scales for transforming forcePatent and forceBiblio map coordinates to plotting coordinates
  // need to call when this.xPlotScale or this.yPlotScale have been modified; called from updateForceMap and this.on_zoom
    this.xForceToPlotScale.range([this.xPlotScale(fMap.minDate), this.xPlotScale(fMap.maxDate)]);
    this.yForceToPlotScale.range([this.yPlotScale(0), this.yPlotScale(fMap.h)]);
  }

  this.updateXAxisLimits = function() {
  // calculate the new x-axis plot limits and store in this.pParam; update this.xPlotScale; allPatentNodes is the d3
  // object for all the g.nodes in the force map; called from updateForceMap.
    var self = this;
    var dateNow = new Date();
    var d3_format = d3.time.format("%Y");
    if (allPatentNodes.size() > 0) {
      var maxDate = d3.max(allPatentNodes.data(), function(d) {return d.date;});
      var minDate = d3.min(allPatentNodes.data(), function(d) {return d.date;});
      var padDate = 0.125*(maxDate.getTime() - minDate.getTime());
      this.pParam.minDate = d3.time.year.floor(new Date(minDate.getTime() - padDate));
      this.pParam.maxDate = d3.time.year.ceil(new Date(Math.min(maxDate.getTime() + padDate, dateNow.getTime())));
      var minYear = this.pParam.minDate.getFullYear();
      var maxYear = this.pParam.maxDate.getFullYear();
      var nYears = maxYear - minYear;
      if (isNaN(nYears) || nYears < 5) {
        var addYears = 5 - nYears;                                     // minimum interval for x axis is 5 years
        var padHigh = Math.floor(addYears/2);
        maxYear = Math.min(maxYear + padHigh, d3.time.year.ceil(dateNow).getFullYear());
        this.pParam.maxDate = d3_format.parse((maxYear).toString());
        this.pParam.minDate = d3_format.parse((maxYear - 5).toString());
      }

      // update the domain of this.xPlotScale based on filing date of patents on the forcePatent map;
      this.pParam.minX = (this.pParam.minX < this.pParam.minDate) ? this.pParam.minX : this.pParam.minDate;
      this.pParam.maxX = (this.pParam.maxX > this.pParam.maxDate) ? this.pParam.maxX : this.pParam.maxDate;
      this.updateXPlotScaling();                                     // update this.xPlotScale
      this.zoom.x(this.xPlotScale);                                  // need to call this.zoom.x when update this.xPlotScale
      var xRange = (this.pParam.maxX.getTime() - this.pParam.minX.getTime())/(365.25*24*60*60*1000) // x-axis range in years
      this.zoom.scaleExtent([xRange/300, xRange/1.2]);
    }
    else {                                                             // no nodes are plotted
      setDefaultDateLimits();
      this.updateXPlotScaling();                                       // update xPlotScale
    }

    function setDefaultDateLimits() {
    // default limits are from Jan 1 next year to 5 years ago.
      var maxYear = d3.time.year.ceil(dateNow).getFullYear();
      self.pParam.maxX = d3_format.parse((maxYear).toString());
      self.pParam.minX = d3_format.parse((maxYear - 5).toString());
      self.pParam.maxDate = undefined;
      self.pParam.minDate = undefined;
    }
  }

  this.updateXAxisContent = function() {
  // calculate new x-axis labels and gridlines; update this.xAxisLabel and this.xAxisGrid axes

    if (allPatentNodes.size() > 0) {
      var nYears = this.pParam.maxX.getFullYear() - this.pParam.minX.getFullYear();
      var tickInt = d3.time.year;                         // default tick interval unit
      var gridInt = d3.time.year;                         // default grid interval unit
      if (nYears < 1) {
        var tickNo = 1;
        var gridInt = d3.time.month;                      // override default grid interval
        var gridNo = 1;
      }
      else if (1 <= nYears && nYears <= 2) {
        var tickNo = 1;
        var gridInt = d3.time.month;                      // override default grid interval
        var gridNo = 1;
      }
      else if (3 <= nYears && nYears <= 4) {
        var tickNo = 1;
        var gridInt = d3.time.month;                      // override default grid interval
        var gridNo = 3;
      }
      else if (5 <= nYears && nYears <= 12) {
        var tickNo = 1;
        var gridInt = d3.time.month;                      // override default grid interval
        var gridNo = 6;
      }
      else if (13 <= nYears && nYears <= 24) {
        var tickNo = 2;
        var gridNo = 1;
      }
      else if (25 <= nYears && nYears <= 36) {
        var tickNo = 4;
        var gridNo = 1;
      }
      else if (37 <= nYears && nYears <= 60) {
        var tickNo = 5;
        var gridNo = 1;
      }
      else if (61 <= nYears && nYears <= 120) {
        var tickNo = 10;
        var gridNo = 2;
      }
      else if (121 <= nYears && nYears <= 240) {
        var tickNo = 20;
        var gridNo = 4;
      }
      else if (241 <= nYears && nYears <= 360) {
        var tickNo = 40;
        var gridNo = 10;
      }
      else if (361 <= nYears && nYears <= 500) {
        var tickNo = 50;
        var gridNo = 10;
      }
      else {
        debug("Unexpected xAxis range in updateXAxisContent")
      }
      this.xAxisLabel.ticks(tickInt, tickNo).scale(this.xPlotScale);    // create the tick label HTML generating function
      this.xAxisGrid.ticks(gridInt, gridNo).scale(this.xPlotScale);     // create the gridline HTML generating function
      xAxisLabelSVG.call(this.xAxisLabel);                              // add tick labels to the plot
      xAxisGridSVG.call(this.xAxisGrid);                                // add gridlines to the plot
      d3.selectAll("g.x-axis-label > g.tick > line").remove();          // remove tick mark from label
      d3.selectAll("g.x-axis-grid > g.tick > text").remove();           // remove text from gridlines
    }
  }

  this.on_zoomstart = function() {
  // remove event handlers on patents, biblios, and main svg to avoid things popping up if pan fast with mouse
    debug("Hello from on_zoom_start");
    allPatentNodes.selectAll("circle").classed({"pointer-events-none": true});
    if (this.pParam.mouse == "normal") {
      allBiblioNodes.select("div.pop1-container").classed({"pointer-events-none": true});    // disable mouse events on
      allBiblioNodes.select("g.pop1-marker").classed({"pointer-events-none": true});        // visible div.pop1-containers
      allBiblioNodes.each(function(d, i) {$(this).off("mouseleave.biblio")
                                                 .off("mouseenter.biblio");});
    }
    svg_main.on("mouseover.biblio", null)
            .on("mousemove.biblio", null)
            .on("mouseoout.biblio", null);
  }

  this.on_zoomend = function() {
  // reattach event handlers on patents, biblios, and main svg
    debug("Hello from on_zoom_end");
    allPatentNodes.selectAll("circle").classed({"pointer-events-none": false});
    if (this.pParam.mouse == "normal") {
      allBiblioNodes.select("div.pop1-container").classed({"pointer-events-none": false});   // disable mouse events on
      allBiblioNodes.select("g.pop1-marker").classed({"pointer-events-none": false});        // visible div.pop1-containers
      allBiblioNodes.each(function(d, i) {$(this).on("mouseleave.biblio", on_mouseleave_force_biblio)
                                                 .on("mouseenter.biblio", on_mouseenter_force_biblio);});
    }
    svg_main.on("mouseover.biblio", on_mouse_main_svg)
            .on("mousemove.biblio", on_mouse_main_svg)
            .on("mouseoout.biblio", on_mouse_main_svg);
  }

  this.on_zoom = function() {
    if (!d3.event.shiftKey) {                      // if shift key is not pressed (not trying to go to "transparent" mode
      debug("In patentMapPlot.on_zoom, event is: ", d3.event);
      this.pParam.minX = this.xPlotScale.invert(0);
      this.pParam.maxX = this.xPlotScale.invert(plotSize.w);
      var totalTransY = this.zoom.translate()[1];
      if (this.zoom.scale() == this.pParam.scale) {          // pan: only apply y translation if zoom event was panning
        this.pParam.panTransY = totalTransY - this.pParam.zoomTransY;
        // apply pan portion of translation to the y axis
        this.updateYPlotZoomScaling();
      }
      else {                                                 // zoom: update zoom-induced component of the translation
        this.pParam.scale = this.zoom.scale();
        // zooming to a new scale induces a translation which we need to remove
        this.pParam.zoomTransY = totalTransY - this.pParam.panTransY;
      }
      this.updateXAxisContent();        
      this.updateForceScaling();
      replotForceMap();
    }

    function replotForceMap() {
    // called from on_zoom event handler
      allPatentNodes.each(function(d, i) {
                      d.updatePlotCoord();});   // update the SVG plotting coordinates .plotX and .plotY for forcePatent map
      allBiblioNodes.each(function(d, i) {
                      d.updatePlotCoord();});   // update the SVG plotting coordinates .plotX and .plotY for forceBiblio map
      allPatentNodes.call(updatePatentNode);    // move forcePatent map nodes to their new positions
      visBibs.call(updateBib);                  // move forceBiblio map biblio popups
      allPatentLinks.call(updatePLink);         // move forcePatent map pLinks
      visBibLinks.call(updateBLink);            // move forceBiblio map bLinks
    }
  }

  // create a zoom function implementing zooming and panning; will zoom the x-axis (this statement must occur after
  // the event handlers have been defined).
  this.zoom = d3.behavior.zoom().on("zoom", this.on_zoom.bind(this))
                               .on("zoomstart", this.on_zoomstart.bind(this))
                               .on("zoomend", this.on_zoomend.bind(this))
                               .x(this.xPlotScale);     // zoom and translate the x axis; just translate the y axis

  this.initialize();
}

function setPlotState(state) {
// set pState.mouse mode and text of status message on the plot according to the desired state ('normal' or 'transparent');
// called from on_click_change_mouse_mode and PatentMapPlot.initialize.
  pState.mouse = state;
  switch(state) {
    case "transparent":
      $("span.mouse-mode-state").text("Transparent");
      break;
    case "normal":
      $("span.mouse-mode-state").text("Normal");
      break;
  }
}

function createNodeLegend() {
// use d3js to create the svg for the node legend at the upper right of the force map; nodeLegend is the
// d3js containing 'g' element
  var gNodeLegend = nodeLegend.append("svg:g").classed({"node-legend": true})
                              .attr({"transform": "translate(71,54)"});
  gNodeLegend.append("svg:line").classed({"node-legend-cited": true})
             .attr({"x1": "0", "y1": "0", "x2": "-40", "y2": "0"});
  gNodeLegend.append("svg:line").classed({"node-legend-citing": true})
             .attr({"x1": "0", "y1": "0", "x2": "20", "y2": "-35"});
  gNodeLegend.append("svg:line").classed({"node-legend-related": true})
             .attr({"x1": "0", "y1": "0", "x2": "20", "y2": "35"});
  var gNodeLegendMap = gNodeLegend.append("svg:g").attr({"transform": "translate(0,0)"});
  gNodeLegendMap.append("svg:circle").classed({"node-legend-node": true})
                .attr({"r": "10", "cx": "0", "cy": "0"});
  gNodeLegendMap.append("svg:use").attr({"xlink:href": "#force-mapped-cross-def"});
  var gNodeLegendMapText = gNodeLegendMap.append("svg:text").classed({"node-label": true})
                .attr({"text-anchor": "middle", "x": "30", "y": "-8"})
                .text("Mapped");
  gNodeLegendMapText.append("svg:tspan")
                    .attr({"text-anchor": "middle", "x": "30", "y": "4"})
                    .text("patent");
  var gNodeLegendCited = gNodeLegend.append("svg:g").attr({"transform": "translate(-40,0)"});
  gNodeLegendCited.append("svg:circle").classed({"node-legend-node": true})
                  .attr({"r": "7", "cx": "0", "cy": "0"});
  var gNodeLegendCitedText = gNodeLegendCited.append("svg:text").classed({"node-label": true})
                .attr({"text-anchor": "middle", "x": "0", "y": "-20"})
                .text("Cited patent");
  gNodeLegendCitedText.append("svg:tspan")
                    .attr({"text-anchor": "middle", "x": "0", "y": "-8"})
                    .text("(USPTO)");
  var gNodeLegendCiting = gNodeLegend.append("svg:g").attr({"transform": "translate(20,-35)"});
  gNodeLegendCiting.append("svg:circle").classed({"node-legend-node": true})
                  .attr({"r": "7", "cx": "0", "cy": "0"});
  var gNodeLegendCitingText = gNodeLegendCiting.append("svg:text").classed({"node-label": true})
                .attr({"text-anchor": "middle", "x": "-31", "y": "-11"})
                .text("Citing patent");
  gNodeLegendCitingText.append("svg:tspan")
                    .attr({"text-anchor": "middle", "x": "-31", "y": "1"})
                    .text("(USPTO)");
  var gNodeLegendRelated = gNodeLegend.append("svg:g").attr({"transform": "translate(20,35)"});
  gNodeLegendRelated.append("svg:circle").classed({"node-legend-node": true})
                  .attr({"r": "7", "cx": "0", "cy": "0"});
  var gNodeLegendRelatedText = gNodeLegendRelated.append("svg:text").classed({"node-label": true})
                .attr({"text-anchor": "middle", "x": "-32", "y": "-10"})
                .text("Related patent");
  gNodeLegendRelatedText.append("svg:tspan")
                    .attr({"text-anchor": "middle", "x": "-32", "y": "2"})
                    .text("(Google)");
  var bBox = nodeLegend.node().getBBox();                        // get bounding box of an SVG element
  nodeLegend.insert("svg:rect", ":first-child").classed({"legend-frame": true})
                 .attr({"x": "-4", "y": "-4", "width": bBox.width + 11, "height": bBox.height + 8});
}

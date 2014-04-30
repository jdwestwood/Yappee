// javascript for functioning of the force map

var allPatentNodes = [];                              // global variables for the forcePatent tick event handler
var allPatentLinks = [];                              // and the zoom event handler
var allBiblioNodes = [];
var allBiblioLinks = [];                              // rendered as bLinks from pinned biblios to associated nodes
var visBibs = [];                                     // global variables for the forceBiblio tick event handler
var visBibLinks = [];                                 // only update plotting info for visible biblios to save time

var labelDistance = 2;

var pop1P = {
  "minWidth": 300,                                    // styling parameters for div.pop1-container
  "maxWidth": 350
};

var compiledPop1Template;                             // will be assigned in map_page_complete.js

// define the force map for the patent nodes, specifying the pNodes, pLinks, and linkStrengths
var forcePatent = d3.layout.force().size([fMap.w, fMap.h]).nodes(patentNodes).links(patentLinks)
              .gravity(0.05).linkDistance(function(link, i) {return Math.abs(link.source.x_fix - link.target.x_fix);})
              .charge(-100).linkStrength(0.1)     // gravity 0.05; linkDistance = 50; linkStrength = 1; charge -10000
              .on("start", on_force_patent_start)
              .on("tick", on_force_patent_tick);

// define the force map for the biblio nodes, specifying the nodes, links (empty list), and no forces between nodes
// forceBiblio map is used for its dragging capability and to be able to plot easily with forcePatent
var forceBiblio = d3.layout.force().size([fMap.w, fMap.h]).nodes(biblioNodes).links([])
                    .gravity(0).linkDistance(0).charge(0).linkStrength(0)
//                          .on("start", on_force_biblio_start)
                      .on("tick", on_force_biblio_tick);

var force_patent_drag = forcePatent.drag()
                 .on("dragstart.biblio", on_dragstart_force_patent)
                 .on("drag.biblio", on_drag_force_patent)
                 .on("dragend.biblio", on_dragend_force_patent);

var force_biblio_drag = forceBiblio.drag()
                 .on("dragstart.biblio", on_dragstart_force_biblio)
                 .on("drag.biblio", on_drag_force_biblio)
                 .on("dragend.biblio", on_dragend_force_biblio);

setupForceMap();

function setupForceMap() {
// called after document has finished loading
  d3.select(document).on("keydown.biblio", on_keydown_document, true)      // get event in the capture phse
                     .on("keyup.biblio", on_keyup_document, true);

  bib.on("click.biblio", on_click_change_mouse_mode, true)                 // div.bib-container; handle events in capture phase
     .on("mousedown.biblio", on_mousedown_change_mouse_mode, true)
     .on("mouseup.biblio", on_mouseup_change_mouse_mode, true);

  svg_main.on("mouseover.biblio", on_mouse_main_svg)
          .on("mousemove.biblio", on_mouse_main_svg)
          .on("mouseoout.biblio", on_mouse_main_svg)
          .on("mouseover.shift", on_mouseover_focus_main_svg);

  zoom_rect.on("click.biblio", on_click_change_mouse_mode, true)                     // handle events in capture phase
           .on("mousedown.biblio", on_mousedown_change_mouse_mode, true)
           .on("mouseup.biblio", on_mouseup_change_mouse_mode, true)
           .call(patentMapPlot.zoom);

  plot.on("click.biblio", on_click_change_mouse_mode, true)                          // handle events in capture phase
      .on("mousedown.biblio", on_mousedown_change_mouse_mode, true)
      .on("mouseup.biblio", on_mouseup_change_mouse_mode, true);
}

function updatePLink() {                                           // move a pLink to its new position
      this.attr("x1", function(d) {return d.source.plotX;})
          .attr("y1", function(d) {return d.source.plotY;})
          .attr("x2", function(d) {return d.target.plotX;})
          .attr("y2", function(d) {return d.target.plotY;});
      if (this.size() > 0) {
        this.each(pLinkErr);
      }
                                  
}

function updateBLink() {                                           // move a BLink to its new position
      this.attr("x1", function(d) {return d.patentNode.plotX;})
          .attr("y1", function(d) {return d.patentNode.plotY;})
          .attr("x2", function(d) {return d.biblioNode.plotX;})
          .attr("y2", function(d) {return d.biblioNode.plotY + 7;});  // connect to biblio itself, not the marker center
      if (this.size() > 0) {
        this.each(bLinkErr);
      }
}

function updatePatentNode() {                                         // move a node to its new position
      this.attr("transform", function(d) {return "translate(" + d.plotX + "," + d.plotY + ")";});
}

function updateBib() {
// 'this' is the d3 selection of all div.bibs that have div.pop1-container.make-displayed
  // move the div.bibs to their new positions
  this.style({"-webkit-transform": function(d) {return "translate(" + d.plotX + "px," + d.plotY + "px)"},   // Chrome
              "transform": function(d) {return "translate(" + d.plotX + "px," + d.plotY + "px)"}});         // Firefox
  this.classed({"out-of-bounds": function(d, i) {     // detect if node is out of the plotting region; if so, do not display
           return (d.plotY < 0 || d.plotY > plotSize.h || d.plotX > plotSize.w || d.plotX < 0);
         }});
}

function updateForceMap() {
// add new nodes to the forcePatent and forceBiblio maps as the patent data is received from EPO
  debug("In updateForceMap, patentNodes: ", patentNodes, "; patentLinks: ", patentLinks);

  // add the new pLinks to the SVG (just new pLinks using .enter.append)
  var pLink = plot.selectAll("line.patent-link").data(forcePatent.links(), function(d) {return d.key;});
  pLink.enter().append("svg:line")
               .classed({"patent-link": true})
               .attr({"data-link-key": function(d, i) {return d.key;}})
               .style({"stroke": function(d, i) {
                                  switch(d.type) {
                                    case "cited":
                                      return "tomato";
                                    case "citing":
                                      return "darkgreen";
                                    case "related":
                                      return "darkblue";
                                  }
                                },
                     "stroke-width": "1px"});
  pLink.exit().remove();

  // add lines connecting nodes to biblios
  var bLink = plot.selectAll("line.biblio-link").data(biblioLinks, function(d) {return d.key;});
  bLink.enter().append("svg:line").classed({"biblio-link": true})
               .attr({"data-patent": function(d, i) {return d.patent_no;}});   // add the new biblio-node bLinks
  bLink.exit().remove();

  // add the new nodes to the SVG (just new nodes using .enter.append); attach event handler to g.node, but enable
  // pointer events only on the node circles.
  var curNode = plot.selectAll("g.node").data(forcePatent.nodes(), function(d) {return d.key;});
  var newNode = curNode.enter().append("svg:g")
                       .classed({"node": true})
                       .attr({"data-patent": function(d, i) {return d.patent_no;}})
                       .on("mouseover.biblio", on_mouseover_force_patent)
                       .on("mousemove.biblio", on_mousemove_force_patent);
  curNode.exit().remove();

  // add new div.bibs to the main bib-container div; newBibDiv is just the new divs (.enter.append); must set z-index on
  // the div.bibs because they are siblings in the DOM; setting z-index directly on the div.pop1-containers does not
  // work since they are not siblings.
  var curBibDiv = bib.selectAll("div.bib").data(forceBiblio.nodes(), function(d) {return d.key;});
  var newBibDiv = curBibDiv.enter().append("div")
                           .classed({"bib": true})
                           .attr({"data-patent": function(d, i) {return d.patent_no;}})
                           .style({"z-index": function(d, i) {return d.z_index;}});

  curBibDiv.exit().remove();

  // jQuery mouseleave event is much more useful here than javascript mouseout event (see comments in the event
  // handler for more details); attach to div.bib so can handle events on both div.pop1-container and g.pop1-marker
  newBibDiv.each(function(d, i) {$(this).on("mouseleave.biblio", on_mouseleave_force_biblio)
                                        .on("mouseenter.biblio", on_mouseenter_force_biblio);});

  plot.selectAll("g.node, line.patent-link, line.biblio-link")
      .sort(function(a, b) {                            // order needs to be line.patent-links, then line.biblio-links,
           if (a.sortOrder < b.sortOrder) return -1;    // then g.nodes, so graphics overlay each other correctly
           if (a.sortOrder > b.sortOrder) return 1;
           return 0;
          }).order();

  on_force_patent_start();                   // refresh lists of nodes, links, and visible biblios on forcePatent map

  patentMapPlot.updateXAxisLimits();         // update the x-axis plot limits
  patentMapPlot.updateXAxisContent();        // update tick locations and labels for patentMapPlot.xAxisLabel and .xAxisGrid
  patentMapPlot.updateForceScaling();        // update the patentMapPlot.xForceToPlotScale according to new plot limits

  // insert the html for the biblio popup that appears when the mouse is over a patent node, and then attach event handlers
  newBibDiv.html(function(d, i) {return compiledPop1Template(
                                  {patent_no: d.patent_no, patent_label: d.label, file_date: d.biblio.file_date,
                                   pub_date: d.biblio.pub_date, title: d.biblio.title, inventors: d.biblio.inventors,
                                   assignee: d.biblio.assignee, abstract: d.biblio.abstract});});
  // select the top-level biblio popup containers div.pop1-container in the html added under the div.bib
  var divPop = newBibDiv.select("div.pop1-container")           // select copies d3 data from div.bib to div.pop1-container
                        .style({"min-width": pop1P.minWidth + "px", "max-width": pop1P.maxWidth + "px"});
  divPop.selectAll("a.pop1-patent-url")                                                     // set patent links
                 .on("click.biblio", on_click_new_patent_url_map)
                 .on("mousedown.biblio", on_mousedown_no_drag);                          // prevent triggering dragstart
  divPop.selectAll("a.pop1-search-url")
                 .on("click.biblio", on_click_new_search_url_map)
                 .on("mousedown.biblio", on_mousedown_no_drag);                          // prevent triggering dragstart
  divPop.select("div.pop1-top-btns")
                 .on("click.biblio", on_click_top_buttons_biblio)
                 .on("mouseover.biblio", on_mouseover_top_buttons_biblio)
                 .on("mouseout.biblio", on_mouseout_top_buttons_biblio);
  divPop.each(function(d,i) {setupMapFavButtons(this, document, "map", d.patent_no);});  // set up map and favorite buttons
  divPop.select("div.pop1-buttons").selectAll("span")                                    // select all buttons (map, fav etc)
                 .on("mousedown.biblio", on_mousedown_no_drag);                          // prevent triggering dragstart
  divPop.select("span.btn-hide-add")                                                     // set up the delete button
                 .attr({"data-patent": function(d, i) {return d.patent_no;}})
                 .on("click.biblio", on_click_delete_btn);
  divPop.select("span.btn-pin-add")                                                      // set up the pin/unpin buttons
                 .attr({"data-patent": function(d, i) {return d.patent_no;}})
                 .on("click.biblio", on_click_pin_btn);

  addPopArrowCircleSVG(newBibDiv);           // add svg for arrow and node circle at top of biblio
  addPopTopBtns(newBibDiv);                  // add svg for buttons at top right of biblio
  setBiblioState(newBibDiv);                 // set css pointer-events according to pState.mouse ('normal' or 'transparent')

  if (allPatentNodes.size() > 0) {           // when page initially loads, stop force map from running so animation goes as
    forcePatent.start();                     // smoothly as possible
  }

  // finish appending svg elements 
  newNode.each(setupMarkers);                                         // add the node markers
  newNode.append("svg:text").text(function(d, i) {return d.label})    // add the node labels to the SVG
         .classed("node-label", true)
         .attr({"text-anchor": "middle", "dominant-baseline": "middle",
               "transform": "translate(0, " + (-labelDistance) + ")",
               "data-patent": function(d, i) {return d.patent_no;}});

  updateLegend();

  // update the node colors
  allPatentNodes.each(updateForceMapSymbolColor);

  newNode.call(force_patent_drag);                                           // allows nodes to be dragged with the mouse
  newBibDiv.call(force_biblio_drag);
}

function setupMarkers(d, i) {
// called from updateForceMap to set up node markers on the force map
// checks if patent_no is in the 'map' or 'favorites' list and changes the node marker if so
// SVG elements do not have innerHTML properies that allows us to add SVG on the fly using d3 .html() or jQuery .after();
// one way to get around this is to follow suggestion in d3 documentation, and add innersvg.js polyfill at
// https://code.google.com/p/innersvg via a script tag in the document header; (need to apply patch to use the <use> tag;
// the alternative, which I ended up going with is to add all the svg using d3 
  var patentNode = d3.select(this);
  var patent_no = d.patent_no;
  var marker = patentNode.append("svg:g").classed({"force-patent-marker": true})
                         .attr({"data-patent": patent_no});
  marker.append("svg:circle");
  updateMarkerOnForceMap(marker, "map");
}

function updateMarkerOnForceMap(marker, page_type) {
// called from setupMarkers, addSourcePatentToForceMap, addMapPatent, on_mouseover_patent_list_patent,
// and on_mouseout_patent_list_patent
// change the marker to type markerType ("normal", "mapped", or "favorite") on the force map,
// depending on prioritized testing of which list(s) the patent is in;
// marker is the d3 g.force-patent-marker element containing the circle svg; page_type is page type
// that the 'map' or 'favorite' button was clicked on or being setup from.

  var patent_no = marker.datum().patent_no;
  // priority of markers is "mapped", "favorite", "normal".
  var onMappedList = (patentLists["map"].indexOf(patent_no) != -1);           // -1 if not in list
  var onFavoritesList = (patentLists["favorites"].indexOf(patent_no) != -1);  // -1 if not in list
  var markerType = (onMappedList) ? "mapped" : ((onFavoritesList) ? "favorite" : "normal");
  switch (markerType) {
    case "normal":
      var markerRadius = 7;
      var circleClass = "force-patent-circle";
      break; 
    case "mapped":
      var markerRadius = 10;
      var circleClass = "force-mapped-circle";
      var iconDef = "#force-mapped-cross-def";
      break;
    case "favorite":
      var markerRadius = 10;
      var circleClass = "force-favorite-circle";
      var iconDef = "#force-favorite-heart-def";
      break;
  }
  marker.attr({"data-marker": markerType});                // update the type of marker it is
  marker.datum().markerRadius = markerRadius;
  marker.select("use").remove();
  var markerCircle = marker.select("circle")
                           .attr({"class": circleClass, "r": markerRadius});
  switch (page_type) {
    case "mapped-list": case "favorites-list":
      markerCircle.style({"stroke-width": "3px"});
      break;
    default:
      markerCircle.style({"stroke-width": null});
  }        
  if (markerType == "mapped" || markerType == "favorite") {
    marker.append("svg:use").attr({"xlink:href": iconDef});
  }
  d3.select("div.bib[data-patent=" + patent_no + "]").select("circle.pop1-marker").attr({"r": markerRadius});
}

function pLinkErr(d) {
  if (d3.select(this).attr("x2") == "NaN") {
    debug("In updatePLink, link is: ", d3.select(this), d, d.target.plotX, d.target.plotY);
  }
}

function bLinkErr(d) {
  if (d3.select(this).attr("x2") == "NaN") {
    debug("In updateBLink, link is: ", d3.select(this), d, d.patentNode.plotX, d.patentNode.plotY);
  }
}

function on_force_patent_start() {
// event handler for forcePatent.start event; also called by updateForceMap
// update the nodes, links, biblios that will be updated on the forcePatent map as the forcePatent layout runs
// tick event handler must update all the visible items on the map
  // need to be sure to select all nodes currently on the map before re-starting
  allPatentNodes = svg.selectAll("g.node")
                      .sort(function(a, b) {                 // sort so the source nodes are drawn last so can see labels
                              return (a.source < b.source) ? -1 : ((a.source > b.source) ? 1 : 0);
                            })
                      .order();
  allBiblioNodes = d3.selectAll("div.bib");
  visBibs = allBiblioNodes.filter(hasPop1Displayed);         // update only div.bibs whose biblios are visible
  allPatentLinks = svg.selectAll("line.patent-link");
  allBiblioLinks = svg.selectAll("line.biblio-link");
  // update only line.biblio-links whose biblios are visible; make sure to update visBibs first
  visBibLinks = allBiblioLinks.filter(function(d, i) {return d.biblioNode.displayed});
  forceBiblio.stop();                                  // forceBiblio is a slave to forcePatent
}

function on_force_biblio_tick(e) {
// tick event handler for the forceBiblio map; if a biblio is not pinned, update its coordinates; if it is
// pinned, do not update coordinates
//debug("Hello from on_force_biblio_tick");
  allBiblioNodes.filter(function(d, i) {return (!d.pinned && !(d.patentNode.drag && pState.mouse == "normal"));}).
    each(function(d, i) {
      d.x = d.patentNode.x;
      d.y = d.patentNode.y;
      d.updatePlotCoord();
    });
  visBibs.call(updateBib);
  visBibLinks.call(updateBLink);
}

function on_drag_force_biblio_tick(e) {
// tick event handler for the forceBiblio map when a node is being dragged
  var draggedBiblio = allBiblioNodes.filter(function(d, i) {return d.drag;});  // get the dragged biblio node
  // update the forceBiblio map coordinates .x and .y
  draggedBiblio.each(function(d, i) { 
//debug("Hello from on_drag_biblio_patent_tick");
//debug("cur tick d: ", d.x, d.y);
        d.plotX = d.orig_plotX + (d.x - d.orig_x);       // follow drag in x direction
        d.x = patentMapPlot.xForceToPlotScale.invert(d.plotX);
//              d.x = d.orig_x;                                // use this to not follow drag in x-direction; do not change d.plotX
        d.plotY = d.orig_plotY + (d.y - d.orig_y);       // drag in y direction
        d.y = patentMapPlot.yForceToPlotScale.invert(d.plotY);
//debug("new tick d: ", d.x, d.y);
      });

  // forcePatent is stopped while dragging biblios, so no need to update the forcePatent map
  visBibs.call(updateBib);
  visBibLinks.call(updateBLink);
}

function on_force_patent_tick(e) {
// tick event handler for the forcePatent map when a node is not being dragged
  allPatentNodes.each(function(d, i) {                                 // update the forcePatent map coordinates .x and .y
//            d.x = d.px + 0.1*(d.x - d.px);
//            d.y = d.py + 0.1*(d.y - d.py);
      d.x = d.x + ((Math.log(10*0.099) - Math.log(10*e.alpha))/(Math.log(10*0.099) - Math.log(10*0.005)))*(d.x_fix - d.x);
                                                // default value of alpha starts at 0.1 and decays exponentially to 0.005
      d.updatePlotCoord();                                       // update the SVG plotting coordinates .plotX and .plotY
    });
  allPatentNodes.call(updatePatentNode);
  allPatentLinks.call(updatePLink);
  on_force_biblio_tick(e);                               // allow forceBiblio to follow forcePatent
}

function on_drag_force_patent_tick(e) {
// tick event handler for the forcePatent map when a node is being dragged
  allPatentNodes.each(function(d, i) {                   // update the forcePatent map coordinates .x and .y
      if (d.drag) {                                      // this patent node is being dragged
//debug("Hello from on_drag_force_patent_tick");
//debug("cur tick d: ", d.x, d.y);
//                d.plotX = d.orig_plotX + (d.x - d.orig_x);   // use this and next line if want to follow drag in x direction
//                d.x = patentMapPlot.xForceToPlotScale.invert(d.plotX);
        d.x = d.orig_x;                                  // do not drag in x direction; do not change d.plotX
        d.plotY = d.orig_plotY + (d.y - d.orig_y);       // drag in y direction
        d.y = patentMapPlot.yForceToPlotScale.invert(d.plotY);
//debug("new tick d: ", d.x, d.y);
      }
      else {
        d.x = d.x + 0.2*(d.x_fix - d.x);
        d.updatePlotCoord();                             // update the SVG plotting coordinates .plotX and .plotY
      }
    });

  allPatentNodes.call(updatePatentNode);
  allPatentLinks.call(updatePLink);
  on_force_biblio_tick(e);                               // allow forceBiblio to follow forcePatent
}

function on_dragstart_force_biblio(d, i) {
//debug("Hello from on_dragstart_force_biblio for patent " + d.patent_no);
  d.drag = true;                              // save the current x position so can restrict the drag to the y direction
  d.orig_x = d.x;
  d.orig_y = d.y;
  d.orig_plotX = d.plotX;
  d.orig_plotY = d.plotY;
  allPatentNodes.filter(function(dd, ii) {return (dd.patent_no != d.patent_no);})
                .selectAll("circle").classed({"pointer-events-none": true});
  svg_main.on("mouseover.biblio", null)
          .on("mousemove.biblio", null)
          .on("mouseoout.biblio", null);
  // pState.mouse is always 'normal' when dragging a biblio
  var otherBibs = allBiblioNodes.filter(function(dd, i) {return (dd.patent_no != d.patent_no);});
  otherBibs.select("div.pop1-container").classed({"pointer-events-none": true});      // disable mouse events on other
  otherBibs.select("g.pop1-marker").classed({"pointer-events-none": true});           // div.pop1-containers
  // disable mouseenter and mouseleave handlers to avoid biblio disappearing and reappearing during drag
  var divBib = d3.select(this);
  $(divBib.node()).off("mouseenter.biblio");  // remove jQuery event handlers
  $(divBib.node()).off("mouseleave.biblio");  // to protect against slow dragging
  
  forceBiblio.on("tick", on_drag_force_biblio_tick);  // attach special tick event handler when dragging
  fMap.alpha = forcePatent.alpha();
  forcePatent.stop();                         // so will not have competing force maps during drag
}

function on_drag_force_biblio(d, i) {
// When the drag handler is called, event.clientX, event.clientY is the position computed as the d.x, d.y
// when the drag was started + pixels traveled by dragging; thus the starting point is in force map coordinates,
// but the distance traveled is in pixels (i.e., plotting coordinates).
// event.dx, event.dy are the changes in pixels from the previous mouse position;
// d.x, d.y are the old force coordinates; they have not yet been updated with the current mouse event coordinates
// by the time the tick handler is called, d.x, d.y values are the same as the drag event.x, event.y;
// changing: event.x, event.y; event.dx, event.dy; or d.x., d.y in the drag handler has no effect on d in tick event handler
// if d.x, d.y are changed in the tick handler, those values are still present when the drag handler is called.

  // check if biblio location relative to its associated patentNode should trigger a change in the pinned status
  // 'dist' is the node-biblio distance that triggers changes
  var dist = 1.7*d.patentNode.markerRadius;
  checkPinTrigger(d3.select(this), d, d.patentNode, dist);
}

function checkPinTrigger(divBib, bibNode, patNode, dist) {
// divBib is the d3 object for the biblio div.bib
// bibNode and patNode are datum objects; one of them is being dragged and the other is stationary 
// d3 element associated with the 'dragged' element; 'dist' is the node-biblio distance that triggers changes

  // if biblio node near the associated patent node
  if (patNode.plotX - bibNode.plotX < dist && bibNode.plotX - patNode.plotX < dist
               && patNode.plotY - bibNode.plotY < dist && bibNode.plotY - patNode.plotY < dist) {
    makeBiblioDetached(divBib);                                    // change from pinned to detached
  }

  // if biblio not pinned and getting too far away the associated patent node
  else if (!bibNode.pinned && !(patNode.plotX - bibNode.plotX < dist && bibNode.plotX - patNode.plotX <  dist
               && patNode.plotY - bibNode.plotY < dist && bibNode.plotY - patNode.plotY < dist)) {
    makeBiblioPinned(divBib);                                       // change from detached to pinned
  }
}

function on_dragend_force_biblio(d, i) {
//debug("Hello from on_dragend_force_biblio for patent " + d.patent_no);
  d.drag = false;
    // need to change d.px, d.py because at end of drag they are set to coordinates based on the current mouse position,
    // not the current node position, causing nodes to bounce back into position in weird ways
  d.px = patentMapPlot.xForceToPlotScale.invert(d.plotX);
  d.py = patentMapPlot.yForceToPlotScale.invert(d.plotY);
  var divBib = d3.select(this);
  if (d.detached) {
    makeBiblioUnpinned(divBib);
  }
  // do not render marker or top-capture if biblio is pinned; wait for dragend since might be dragging on the marker
  if (d.pinned) {
    makeBiblioPinnedTop(divBib);
  }
  allPatentNodes.selectAll("circle").classed({"pointer-events-none": false});    // disable mouse events on nodes
  svg_main.on("mouseover.biblio", on_mouse_main_svg)
          .on("mousemove.biblio", on_mouse_main_svg)
          .on("mouseoout.biblio", on_mouse_main_svg);
  // pState.mouse is always 'normal' when dragging a biblio
  var otherBibs = allBiblioNodes.filter(function(dd, i) {return (dd.patent_no != d.patent_no);});
  otherBibs.select("div.pop1-container").classed({"pointer-events-none": false});      // disable mouse events on other
  otherBibs.select("g.pop1-marker").classed({"pointer-events-none": false}); // visible div.pop1-containers
  var divBib = d3.select(this);
  $(divBib.node()).on("mouseenter.biblio", on_mouseenter_force_biblio);  // reattach jQuery event handlers
  $(divBib.node()).on("mouseleave.biblio", on_mouseleave_force_biblio);

  forceBiblio.on("tick", on_force_biblio_tick);
  forceBiblio.stop();
  forcePatent.alpha(Math.max(fMap.alpha, 0.06));                         // restart forcePatent so everything updates
}

function on_dragstart_force_patent(d, i) {
//debug("Hello from on_dragstart_force_patent for patent " + d.patent_no);
//debug(d3.event);
  d.drag = true;                              // save the current x position so can restrict the drag to the y direction
  d.orig_x = d.x;
  d.orig_y = d.y;
  d.orig_plotX = d.plotX;
  d.orig_plotY = d.plotY;
  allPatentNodes.filter(function(dd, ii) {return (dd.patent_no != d.patent_no);})
                .selectAll("circle").classed({"pointer-events-none": true});
  svg_main.on("mouseover.biblio", null)
          .on("mousemove.biblio", null)
          .on("mouseoout.biblio", null);
  if (pState.mouse == "normal") {
    var otherBibs = allBiblioNodes.filter(function(dd, ii) {return (dd.patent_no != d.patent_no);});
    otherBibs.select("div.pop1-container").classed({"pointer-events-none": true});      // disable mouse events on other
    otherBibs.select("g.pop1-marker").classed({"pointer-events-none": true});      // visible div.pop1-containers
    // disable mouseenter and mouseleave handlers to avoid biblio disappearing and reappearing during drag
    var divBib = d3.select("div.bib[data-patent=" + d.patent_no + "]");
    $(divBib.node()).off("mouseenter.biblio");  // remove jQuery event handlers
    $(divBib.node()).off("mouseleave.biblio");  // to protect against slow dragging
  }
  forcePatent.on("tick", on_drag_force_patent_tick);   // attach special tick event handler when dragging
  fMap.alpha = forcePatent.alpha();
  forcePatent.stop();                         // so will not have competing force maps during drag
  d.fixed = true;                             // so node does not move after dragging
}

function on_drag_force_patent(d, i) {
// When the drag handler is called, event.x, event.y is the position computed as the d.x, d.y when the drag was started
// + pixels traveled by dragging; thus the starting point is in force map coordinates, but the distance traveled is
// in pixels (i.e., plotting coordinates).
// event.dx, event.dy are the changes in pixels from the previous mouse position;
// d.x, d.y are the old force coordinates; they have not yet been updated with the current mouse event coordinates
// by the time the tick handler is called, d.x, d.y values are the same as the drag event.x, event.y;
// changing: event.x, event.y; event.dx, event.dy; or d.x., d.y in the drag handler has no effect on d in tick event handler
// if d.x, d.y are changed in the tick handler, those values are still present when the drag handler is called.

  // check if patentNode location relative to its associated biblioNode should trigger a change in the pinned status
  if (pState.mouse == "normal") {
    var divBib = visBibs.filter(function(dd, ii) {return (dd.patent_no == d.patent_no);});
    var dist = 1.7*d.markerRadius;
    if (divBib.size() > 0) {
      checkPinTrigger(divBib, d.biblioNode, d, dist);
    }
  }
}

function on_dragend_force_patent(d, i) {
//debug("Hello from on_dragend_force_patent for patent " + d.patent_no);
  d.drag = false;
    // need to change d.px, d.py because at end of drag they are set to coordinates based on the current mouse position,
    // not the current node position, causing nodes to bounce back into position in weird ways
  d.px = patentMapPlot.xForceToPlotScale.invert(d.plotX);
  d.py = patentMapPlot.yForceToPlotScale.invert(d.plotY);
  var divBib = visBibs.filter(function(dd, ii) {return (dd.patent_no == d.patent_no);});
  if (d.biblioNode.detached) {
    makeBiblioUnpinned(divBib);
  }
  // do not render marker or top-capture if biblio is pinned
  if (d.biblioNode.pinned) {
    makeBiblioPinnedTop(divBib);
  }
  allPatentNodes.selectAll("circle").classed({"pointer-events-none": false});    // re-enable mouse events on nodes
  svg_main.on("mouseover.biblio", on_mouse_main_svg)
          .on("mousemove.biblio", on_mouse_main_svg)
          .on("mouseoout.biblio", on_mouse_main_svg);
  if (pState.mouse == "normal") {
    var otherBibs = allBiblioNodes.filter(function(dd, i) {return (dd.patent_no != d.patent_no);});
    otherBibs.select("div.pop1-container").classed({"pointer-events-none": false});      // disable mouse events on other
    otherBibs.select("g.pop1-marker").classed({"pointer-events-none": false}); // visible div.pop1-containers
    var divBib = d3.select("div.bib[data-patent=" + d.patent_no + "]");
    $(divBib.node()).on("mouseenter.biblio", on_mouseenter_force_biblio);  // reattach jQuery event handlers
    $(divBib.node()).on("mouseleave.biblio", on_mouseleave_force_biblio);
  }
  forcePatent.on("tick", on_force_patent_tick);
  forcePatent.alpha(Math.max(fMap.alpha, 0.06));                           // restart forcePatent so everything updates
}


function on_click_change_mouse_mode(d, i) {
// called from the zoom rectangle (zoom_rect), biblio containers (div.pop1-container), and force plot container
// (g.force-plot)
//debug("In on_click_change_mouse_mode, event and target are: ", d3.event, d3.event.target);
  // event.defaultPrevented is set true if the click event was from a drag (see d3js force.drag() documentation)
  if (d3.event.shiftKey && !d3.event.defaultPrevented) {
    d3.event.preventDefault();     // prevents Shift-click from opening new browser window from links in biblio!
    d3.event.stopPropagation();
    var divBib = d3.selectAll("div.bib");
    switch (pState.mouse) {
      case "normal":
        debug("Mouse mode changed from normal to transparent");
        setPlotState("transparent");
        setBiblioState(divBib);                              // called after setting pState.mouse = 'transparent'
        break;
      case "transparent":
        debug("Mouse mode changed from tranparent to normal");
        setPlotState("normal");
        setBiblioState(divBib);                              // called after setting pState.mouse = 'normal'
        if (topBiblio) {
          // need to simulate the mouse enter event on the top biblio because reenabling pointer-events when
          // mouse is already over a biblio does not trigger the mouseenter event.
          mouseenter_force_biblio(topBiblio.divBib);
        }
        break;
    }
  }
}

function setBiblioState(divBib) {
// given a d3 selection of div.bib's, set the visibility of various features according to the mouse state
// in pState.mouse ('normal' or 'transparent'); called from on_click_change_mouse_mode and updateForceMap
// when new biblios are added to the force map.
  switch (pState.mouse) {                               // from normal to transparent
    case "transparent":
      // changing pointer-events on div.pop1-container propagates to children div.pop1-buttons, a.pop1-patent-url,
      // and a.pop1-search-url
      // setting pointer-events to none on div.pop1-container will always trigger the mouseleave event
      // when the mouse is over it; cannot prevent it by removing the mouseleave event handler in the
      // present event handler; note that if the mouse is on a pinned biblio, we do want to trigger the mouseleave
      // event so the link highlighting and the z-index get reset to their defaults
      divBib.select("g.pop1-marker").classed({"pointer-events-none": true});        // marker for bilibo
      divBib.select("div.pop1-container").classed({"pointer-events-none": true});   // triggers mouseleave over pinned biblio
      divBib.selectAll("rect.pop1-top-btn").classed({"pointer-events-none": true}); // all pop1-top-btns
      break;
    case "normal":                                 // from transparent to normal
      // changing pointer-events on div.pop1-container propagates to children div.pop1-buttons, a.pop1-patent-url,
      // and a.pop1-search-url
      divBib.select("div.pop1-container").classed({"pointer-events-none": false});    // will fire mouseenter event
      divBib.select("g.pop1-marker").classed({"pointer-events-none": false});         // marker for biblio
      divBib.selectAll("rect.pop1-top-btn").classed({"pointer-events-none": false});  // all pop1-top-btns
      break;
  }
}      

function on_mouseover_focus_main_svg(d, i) {
// give document the focus when mouse moves over svg_main so the Shift-click behavior works the first time
//debug("Hello from on_mouseover_focus_main_svg");
  window.focus();
  $(document).click();
}

function on_keydown_document(d, i) {
// detect if shift key is pressed
  if (!pState.shiftKey && d3.event.shiftKey) {                       // if this is the first keydown event
//debug("Hello from on_keydown_document");
    pState.shiftKey = true;
    allBiblioNodes.select("div.pop1-container").classed({"default-cursor": true});  // disable the 'move' cursor
    allBiblioNodes.selectAll("span.hide-result-btn").classed({"default-cursor": true});  // disable the 'pointer' cursor
    allBiblioNodes.selectAll("a.pop1-patent-url, a.pop1-search-url").classed({"default-cursor": true});
    allBiblioNodes.select("g.pop1-marker").classed({"default-cursor": true});
    allPatentNodes.select("circle").classed({"default-cursor": true});
  }
}

function on_keyup_document(d, i) {
// detect if shift key is released
  if (d3.event.keyCode == 16) {                                      // the shift key
//debug("Hello from on_keyup_document");
    pState.shiftKey = false;
    allBiblioNodes.select("div.pop1-container").classed({"default-cursor": false});  // disable the 'move' cursor
    allBiblioNodes.selectAll("span.hide-result-btn").classed({"default-cursor": false});
    allBiblioNodes.selectAll("a.pop1-patent-url, a.pop1-search-url").classed({"default-cursor": false});
    allBiblioNodes.select("g.pop1-marker").classed({"default-cursor": false});
    allPatentNodes.select("circle").classed({"default-cursor": false});
  }
}

function on_mousedown_change_mouse_mode(d, i) {
// needed for Shift-click behavior
//debug("Hello from on_mousedown_change_mouse_mode");
  if (d3.event.shiftKey && !d3.event.defaultPrevented) {
    d3.event.preventDefault();     // prevents Shift-click from opening new browser window from links in biblio!
    d3.event.stopImmediatePropagation();
  }
  else {
    // needed to prevent text selection during biblio drag in Firefox even with CSS -moz-user-select: none
    // added as fix to Firefox 4/8/2014; did not seem to break anything in Chrome.
    d3.event.preventDefault();
  }
}

function on_mouseup_change_mouse_mode(d, i) {
// needed for Shift-click behavior
//debug("Hello from on_mouseup_change_mouse_mode");
  if (d3.event.shiftKey && !d3.event.defaultPrevented) {
    d3.event.preventDefault();     // prevents Shift-click from opening new browser window from links in biblio!
    d3.event.stopImmediatePropagation();
  }
}

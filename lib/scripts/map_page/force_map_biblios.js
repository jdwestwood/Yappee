// javascript for the biblios on the force map

// topBiblio will contain an object with the div.bib, div.pop1-container, and g.pop1-marker that became visible
// due to mouseover on a forcePatent node.
var topBiblio = undefined;

function on_mouseover_force_patent(d, i) {
  if (!d.drag) {                             // stop event from bubbling up to svg_main handler
    d3.event.stopPropagation();              // unless the node is being dragged (exception prevents jerky dragging)
  }
  fMap.alpha = forcePatent.alpha();
  forcePatent.stop();
  var patent_no = d3.select(this).attr("data-patent");
//debug("Hello from mouseover_force_patent for patent " + patent_no);
  // there must never be more than one topBiblio at a time; the following block prevents buggy behavior caused
  // by moving the mouse very quickly over a forcePatent node, can sometimes fail to trigger a mouseenter/mouseleave
  // sequence on the associated biblio; if then move mouse quickly over a different forcePatent node without triggering
  // an event on the zoom_rect background, the original biblio does not disappear.
  // always make any old topBiblio disappear if it is for a different patent_no 
  if (topBiblio && topBiblio.divBib.attr("data-patent") != patent_no) {
    clearBiblioTimeout(topBiblio.divBib);
    mouseleave_force_biblio(topBiblio.divBib);         // sets topBiblio = undefined
  }
  d3.select("text.node-label[data-patent=" + patent_no + "]").classed({"visited-label": true});
  var divBib = d3.select("div.bib[data-patent=" + patent_no + "]");
  var divPop = divBib.select("div.pop1-container");
  var gMarker = divBib.select("g.pop1-marker");
  if (!divBib.datum().pinned) {                        // if the biblio is not pinned (i.e., not already visible)
    var bibLink = plot.select("line.biblio-link[data-patent=" + patent_no + "]");
    divBib.call(updateBib);                            // update current forceBiblio map coordinates of the parent div.bib
    bibLink.call(updateBLink);                         // update bLink position before displaying
    divPop.classed({"make-displayed": true});
    bibLink.classed({"make-displayed": true});
    divBib.select("svg.pop1-arrow-circle").classed({"make-displayed": true});
    visBibs = allBiblioNodes.filter(hasPop1Displayed);       // re-select div.bibs whose biblios are visible
    // reselect line.biblio-links whose biblios are visible; make sure to update visBibs first
    visBibLinks = allBiblioLinks.filter(function(d, i) {return d.biblioNode.displayed});
  }
  topBiblio = {"divBib": divBib, "divPop": divPop, "gMarker": gMarker};
  mouseenter_force_biblio(divBib);
}

function hasPop1Displayed(d, i) {
// 'this' is a div.bib element; returns true if the element has a child div.pop1-container.make-displayed
// called from mouseleave_force_biblo
  d.displayed = (d3.select(this).select("div.pop1-container.make-displayed").size() > 0);
  return d.displayed;
}

function on_mouseout_force_patent(d, i) {
// placeholder at this point
//debug("Hello from mouseout_force_patent");
}

function on_mousemove_force_patent(d, i) {
  if (!d.drag) {                             // stop event from bubbling up to svg_main handler
    d3.event.stopPropagation();              // unless the node is being dragged (exception prevents jerky dragging)
  }
}

function on_mouseenter_force_biblio(event) {
// jQuery event handler for div.bib when it is capturing mouse events
//        event.stopPropagation();
  var divBib = d3.select(this);                        // note 'this' is passed by jQuery
  clearBiblioTimeout(divBib);
  // there must never be more than one topBiblio at a time; the following block prevents buggy behavior caused
  // by moving the mouse very quickly over a forcePatent node, can sometimes fail to trigger a mouseenter/mouseleave
  // sequence on the associated biblio; if then move mouse quickly over a different pinned biblio without triggering
  // an event on the zoom_rect background, the original one does not disappear.
  // always make any old topBiblios disappear:
  if (topBiblio && (topBiblio.divBib.datum().patent_no != divBib.datum().patent_no)) {
    mouseleave_force_biblio(topBiblio.divBib);         // sets topBiblio = undefined
  }

  // if divBib is not already the active biblio because we did not enter the biblio via
  // on_mouseover_force_patent, but entered a pinned biblio directly 
  if (divBib.style("z-index") != pState.zMax + 1) {
    mouseenter_force_biblio(divBib);
  }
}

function mouseenter_force_biblio(divBib) {
// divBib is a d3 div.bib; function is called from on_mouseover_force_patent (g.node)
// and on_mouseenter_force_biblio (div.pop1-container) event handlers
  var patent_no = divBib.attr("data-patent");
//debug("Hello from mouseenter_force_biblio function for patent " + patent_no);
  // there must never be more than one topBiblio at a time
  divBib.style({"z-index": pState.zMax + 1});          // bring to front temporarily
  if (pState.mouse == "normal") {                      // only show map, favorites, pin, and delete buttons in "normal" mode
    divBib.select("div.pop1-buttons").classed({"make-visible": true});
  }
  // highlight pLinks and bLinks to the node
  highlightLinks(patent_no);
}

function on_mouseleave_force_biblio(event) {
// jQuery event handler for div.pop1-container when it is capturing mouse events ("normal" mouse mode); use the jQuery
// mouseleave event, which fires when the mouse leaves the element to which the event handler is attached.  In the
// present case, the div.pop1-container is the parent of child elements that trigger mouseover and mouseout
// events when the mouse enters and leaves each one; mouseleave is only triggered when the mouse leaves the parent
// div.pop1-container.
  var divBib = d3.select(this);                    // note 'this' is passed by jQuery
  // condition needed because mouseleave event always triggers when entering "transparent" mode and need to prevent
  // the biblio from disappearing when it is not pinned
  if (pState.mouse == "normal" || divBib.datum().pinned) {
//debug("Hello from mouseleave_force_biblio event handler");
    divBib.datum().runningTimeout = window.setTimeout(mouseleave_force_biblio.bind(this, divBib), 500);
  }
  else {                    // special case when mouseleave is triggered during transition from "normal" to "transparent"
    divBib.select("div.pop1-buttons").classed({"make-visible": false});
  }
}

function mouseleave_force_biblio(divBib) {
// divBib is a d3 div.bib; function is called from the div.bib mouseleave event handler and from
// on_mouseover_force_patent, on_mouse_main_svg (as part of simulating a mouseout event on a
// div.pop1-container when it is transparent to mouse events), on_transitionend_opacity_biblio,
// and on_mouseenter_force_biblio.
  divBib.datum().runningTimeout = undefined;
  var patent_no = divBib.attr("data-patent");
//debug("Hello from mouseleave_force_biblio function for patent " + patent_no);
  if (!divBib.datum().pinned) {                         // if the biblio is not pinned (i.e., already visible)
    if (!divBib.datum().transition) {                   // if the biblio is not transitioning back to its patent node
      divBib.select("div.pop1-container").classed({"make-displayed": false});
      plot.select("line.biblio-link[data-patent=" + patent_no + "]").classed({"make-displayed": false});
      divBib.select("svg.pop1-arrow-circle").classed({"make-displayed": false});
    }
    visBibs = allBiblioNodes.filter(hasPop1Displayed);       // re-select div.bibs whose biblios are visible
    // reselect line.biblio-links whose biblios are visible; make sure to update visBibs first
    visBibLinks = allBiblioLinks.filter(function(d, i) {return d.biblioNode.displayed});
  }
  topBiblio = undefined;
  divBib.style({"z-index": function(d, i) {return d.z_index;}});     // set z_index back to original position
  divBib.select("div.pop1-buttons").classed({"make-visible": false});  // return map, favorite, etc buttons to default state
  // normal width pLinks and bLinks to the node
  unhighlightLinks(patent_no);
}

function on_mouse_main_svg() {
// when in "transparent" mode (no mouse events on div.pop1-containers), detect whether the mouse is over the
// top visible biblio (div.pop1-container); if not, call mouse_leave_force_biblio to make the biblio disappear
// the .elementFromPoint method only returns an element if pointer events are enabled on it
// <a> elements do not pass mousemove events through them
//debug("Hello from on_mouse_main_svg: ", d3.event);
  var evtTgt = d3.event.target
  // if a biblio is visible and event is from force plot (zoom_rect) or main svg area (svg_main)
  if (topBiblio && (evtTgt == zoom_rect.node() || evtTgt == svg_main.node())) {
    var divBib = topBiblio.divBib;
    switch (pState.mouse) {
      // if div.pop1-containers are transparent to mouse events and there has been a div.pop1-container
      // under the mouse check if it is still under the mouse (there must never be more than one topBiblio)
      case "transparent":
        $(divBib.node()).off("mouseleave.biblio");              // remove jQuery mouseleave and mouseenter event handlers
        $(divBib.node()).off("mouseenter.biblio");              // they will be triggered otherwise
        topBiblio.divPop.classed({"pointer-events-none": false});              // activate mouse events
        topBiblio.gMarker.classed({"pointer-events-none": false});
        // see if the biblio is the topmost element; use .clientX, .clientY to work in FF and Chrome
        // (not .x, .y which works only in Chrome).
        var topElement = document.elementFromPoint(d3.event.clientX, d3.event.clientY);
        topBiblio.divPop.classed({"pointer-events-none": true});
        topBiblio.gMarker.classed({"pointer-events-none": true});
        $(divBib.node()).on("mouseleave.biblio", on_mouseleave_force_biblio);  // reattach mouseleave and mouseenter
        $(divBib.node()).on("mouseenter.biblio", on_mouseenter_force_biblio);  // event handlers
        // note that topElement can be divPop, gMarker or any of its children that also capture mouse
        // events, so cannot simply test for topElement != divPop or gMarker.
        if (topElement == zoom_rect.node() || topElement == svg_main.node()) {
          mouseleave_force_biblio(divBib);
        }
        break;
      case "normal":                                     // sometimes (rarely) happens if mouse is moving very quickly
        if (!divBib.datum().runningTimeout) {
          mouseleave_force_biblio(divBib);                 // and the normal mouseleave event is somehow not triggered
        }
        break;
    }
    if (pState.transition  == 0) {
      forcePatent.alpha(Math.max(fMap.alpha, 0.06));
    }
    return;
  }
  if (d3.event.relatedTarget && (evtTgt == zoom_rect.node() || evtTgt == svg_main.node())
           && pState.mouse == "normal"  && pState.transition == 0) {  // if mouse enters from a div.pop1-container or a
    forcePatent.alpha(Math.max(fMap.alpha, 0.06));                    // g.pop1-marker, .relatedTarget is not null
  }
}

function on_click_new_patent_url_map(d, i) {
// need to call the on_click_new_patent_url event handler set up by jQuery, which is expecting the event object
// as the only argument and event data in event.data
  d3.event.data = {$context: document, page: "map"};
  on_click_new_patent_url.call(this, d3.event);
}

function on_click_new_search_url_map(d, i) {
// need to call the on_click_new_search_url event handler set up by jQuery, which is expecting the event object
// as the only argument
  on_click_new_search_url.call(this, d3.event);
}

function on_mousedown_no_drag(d, i) {
// event handler attached to all links and buttons (map, fav, etc) within a biblio; do not let mousedown
// initiate a drag event.
  d3.event.stopPropagation();
}

function on_mouseover_top_buttons_biblio(d, i) {
// event handler attached to div.pop1-top-buttons, handling mouseover event on front, back, full/short buttons;
// had a lot a trouble getting svg buttons to pop up all the time; found the solution at:
// http://stackoverflow.com/questions/3485365/how-can-i-force-webkit-to-redraw-repaint-to-propagate-style-changes
// when style changes, and re-draw is needed, apparently Chrome has some issues; need to force a redraw; can do
// a couple ways - one shown below and the other is to simply access the .offsetHeight or other property which
// forces the browser to check the visual layout and apparently update it in the process; problem occurs in event
// handlers only
  // note the event needs to propagate so the handler for mouseenter on the div.pop1-container is also triggered.
//debug("Hello from on_mouseover_top_buttons_biblio");
  var divTop = d3.select(this);
  var patent_no = divTop.attr("data-patent");
  var divBib = d3.select("div.bib[data-patent=" + patent_no + "]");
  divBib.on("mousedown.drag", null);                        // remove drag handler from the div.bib
  // opacity: 0 makes the div and descendants not visible but still responding to mouse events;
  // visibility: hidden causes trouble because hidden HTML elements do not respond to mouse events;
  // hidden SVG elements can respond to mouse events, but behavior is fun when they are inside a div
  // with visibility: hidden.
  divTop.classed({"make-opaque": true});
//      using opacity instead of visibility makes the following trick unnecessary
//        divTop.classed({"make-not-displayed": true});           // force redraw - step 1 set display to none
//        // step 2 - force browser to check which element is on top; use .clientX, .clientY to work in FF and Chrome;
//        // (.x, .y works only in Chrome).
//        document.elementFromPoint(d3.event.clientX, d3.event.clientY);
//        divTop.classed({"make-not-displayed": false});          // step 3 - set display back to block
}

function on_mouseout_top_buttons_biblio(d, i) {
// event handler attached to div.pop1-top-buttons, handling mouseover event on front, back, full/short buttons
//debug("Hello from on_mouseout_top_buttons_biblio");
  var divTop = d3.select(this);
  var patent_no = divTop.attr("data-patent");
  var divBib = d3.select("div.bib[data-patent=" + patent_no + "]");
  divBib.call(force_biblio_drag);                         // reattach drag handler to div.bib
  divTop.classed({"make-opaque": false});
}

function on_click_top_buttons_biblio(d, i) {
// event handler is attached to the div.pop1-top-btns element; event target elements are
// rect.pop1-full-btn, rect.pop1-close-btn, rect.pop1-front-btn, and rect.pop1-back-btn.
  d3.event.stopPropagation();
  d3.event.preventDefault();
  debug("Hello from on_click_top_buttons_biblio. Event is ", d3.event);
  var patent_no = d3.select(this).attr("data-patent");
  var clickedBtn = d3.select(d3.event.target);
  switch (true) {
    case clickedBtn.classed("pop1-full-btn"):                        // go to the full biblio
      var divPop = d3.select("div.pop1-container[data-patent=" + patent_no+"]");
      divPop.selectAll("div.pop1-inventors, div.pop1-abstract").classed({"make-displayed": true});
      d3.select(this).select("g.pop1-close").classed({"make-not-displayed": false});
      d3.select(this).select("g.pop1-full").classed({"make-not-displayed": true});
      break;
    case clickedBtn.classed("pop1-close-btn"):                       // go to the short biblio - undo changes above
      d3.select(this).select("g.pop1-full").classed({"make-not-displayed": false});
      d3.select(this).select("g.pop1-close").classed({"make-not-displayed": true});
      var divPop = d3.select("div.pop1-container[data-patent=" + patent_no+"]");
      divPop.selectAll("div.pop1-inventors, div.pop1-abstract").classed({"make-displayed": false});
      break;
    case clickedBtn.classed("pop1-front-btn"):
      pState.zMax += 1;
      d3.select(this).datum().z_index = pState.zMax;
      break;
    case clickedBtn.classed("pop1-back-btn"):
      pState.zMin -= 1;
      d3.select(this).datum().z_index = pState.zMin;
      break;
  }
}

function on_click_delete_btn(d, i) {
// delete the patent and associated pLinks and bLinks from the forcePatent and forceBiblio maps;
// keep the biblio data available in case the node is replotted;
// delete from patentNodes and patentLinks arrays which provide data for d3;
// delete from patentsPlotted which track which patents and pLinks are plotted;
// delete nodes whose only pLink is to the node being deleted;
// if deleted patent is a source patent, delete it from the patentLists["map"] list and unclick all the
// associated map buttons;
  var deleteBtn = d3.select(this).classed({"make-not-displayed": true});  // hide so cannot click twice quickly
  var patent_no = deleteBtn.attr("data-patent");
  deletePatentFromMap(patent_no, "single", on_delete_complete);

  function on_delete_complete() {
    setUndoButtonState();     // will set Undo button state based on whether deleted list has any patents in  it
    setClearButtonState();    // will set Clear button state based on whether patentsPlotted still has any patents in it
  }
}

function on_click_pin_btn(d, i) {
// event handler for clicking the pin/unpin button, in which case 'this' is the span element for the pin button
//debug("Hello from on_click_pin_btn");
  var divBib = d3.select("div.bib[data-patent=" + d.patent_no + "]");
  var coord = {};
  // clone the d3.event properties as they will disappear later; use .clientX, .clientY to work in both FF and
  // Chrome (.x, .y works only in Chrome).
  $.extend(coord, {"x": d3.event.clientX, "y": d3.event.clientY});
  // when biblio is unpinned, the mousedown/mouseup sequence triggers the biblio dragstart/dragend handlers;
  // the biblio returns to the forcePatent node due to setting the forcePatent alpha value at the end of
  // dragend, which causes all positions to update; the biblio will also disappear if the mouseleave event is
  // triggered by the biblio moving out from under the mouse
  if (d.pinned) {                                            // unpin the biblio
    fMap.alpha = forcePatent.alpha();
    // stop the forcePatent force map to prevent biblio returning immediately to the patentNode; 
    // forceBiblio is automatically started during any biblio drag operation, but is stopped in the
    // dragend handler for the biblio.
    forcePatent.stop();
    $(divBib.node()).on("mousemove.transition", on_mousemove_unpinned_biblio);       // jQuery event
    makeBiblioUnpinned(divBib);
    // set up the new biblio position back at the node
    d.x = d.patentNode.x; d.y = d.patentNode.y;
    d.updatePlotCoord();                                     // biblio .datum() now has the new plot coordinates
    // use d3 to make a CSS transition in the transform property (doing up the transition using the CSS 'transition'
    // does not seem to mix well with doing the next transition on the biblioLink using d3; the biblio transition
    // gets canceled) 
    d.transition = true;
    pState.transition += 1;                                  // number of biblios transitioning
    divBib.transition().ease("linear").duration(1000*pState.transformTime)
                       .style({"-webkit-transform": "matrix(1,0,0,1," + d.plotX + "," + d.plotY + ")",
                               "transform": "matrix(1,0,0,1," + d.plotX + "," + d.plotY + ")"})
                       .each("end", on_transitionend_unpinned_biblio);
    d3.select("line.biblio-link[data-patent=" + d.patent_no + "]").transition() // trigger the animation on the biblio-link
               .ease("linear").duration(1000*pState.transformTime)
               .attr({"x2": d.plotX, "y2": d.plotY});
    var transTimeout = window.setTimeout(checkMouseOverBiblio, 50);
  }
  else {                                                                       // pin the biblio
    makeBiblioPinned(divBib);
    makeBiblioPinnedTop(divBib);
  }

  function checkMouseOverBiblio() {
  // timeout function to check if mouse is still over divBib; set d.mouseleave accordingly
    d.mouseleave = !isMouseOverBiblio(divBib, coord);
//debug("Hello from checkMouseOverBiblio");
    if (!d.mouseleave && d.transition) {                                       // if mouse still over biblio during
      transTimeout = window.setTimeout(checkMouseOverBiblio, 50);              // transition check again in 50 msec
    }
  }

  function on_transitionend_unpinned_biblio(dd, ii) {
  // note that the d3.event object is not available for d3 transition 'end' events
  // called when the biblio is finished moving back to its patentNode in on_click_pin_btn
//debug("Hello from on_transitionend_unpinned_biblio");
    window.clearTimeout(transTimeout);
    var divBib = d3.select(this);
    // fires when the transition of the unpinned biblio back to its forcePatent node is complete
    if (d.mouseleave) {                                                    // if mouse is no longer over the biblio
      d.mouseleave = false;                                                // animate its disappearance at the node
      divBib.transition().duration(1000*pState.opacityTime)
                         .style({"opacity": 0})                            // animate disappearance of biblio at the node
                         .each("end", on_transitionend_opacity_biblio);
    }
    else {
      d.transition = false;                                                // transition ended with mouse still over biblio
      pState.transition -= 1;
      if (pState.transition  == 0) {
        forcePatent.alpha(Math.max(fMap.alpha, 0.06));
      }
    }
    $(divBib.node()).off("mousemove.transition");                          // remove transition mousemove handler
  }

  function on_transitionend_opacity_biblio(dd, ii) {
  // fires when the transition of the biblio to transparent is complete (if biblio is no longer under mouse)
  // note that the d3.event object is not available for d3 transition 'end' events
//debug("Hello from on_transitionend_opacity_biblio");
    d.transition = false;                                               // transition ended with mouse no longer over biblio
    pState.transition -= 1;
    var divBib = d3.select(this);
    if (divBib.style("z-index") != d.z_index) {                          // mouseleave was never called; biblio still on top
      clearBiblioTimeout(divBib);
      mouseleave_force_biblio(divBib);                                   // call the normal mouseleave function
    }
    else {                                                               // mouseleave was called with d.transition = true
      divBib.select("div.pop1-container").classed({"make-displayed": false});    // make the remaining changes that were
      plot.select("line.biblio-link[data-patent=" + d.patent_no + "]").classed({"make-displayed": false});
      divBib.select("svg.pop1-arrow-circle").classed({"make-displayed": false}); // postponed in mouseleave_force_biblio
    }
    divBib.style({"opacity": 1});                                        // reset to normal value
    if (pState.transition  == 0) {
      forcePatent.alpha(Math.max(fMap.alpha, 0.06));
    }
  }

  function on_mousemove_unpinned_biblio(event) {                         // handling jQuery event
//debug("Hello from on_mousemove_unpinned_biblio");
  // update coord if user moves the mouse while the biblio is transitioning; also triggered by disappearance of
  // the pin/unpin button and its replacement under the mouse by the delete button; then as the biblio moves, it
  // is triggered as new biblio HTML elements move under the mouse pointer.
    $.extend(coord, {"x": event.clientX, "y": event.clientY});   // clone the event properties as they will disappear later
  }
}

function clearBiblioTimeout(divBib) {
// clears a timeout, if any, running before calling on_mouseleave_force_biblio; divBib is a d3 div.bib.
  if (divBib.datum().runningTimeout) {
    window.clearTimeout(divBib.datum().runningTimeout);
    divBib.datum().runningTimeout = undefined;
  }
}       

function highlightLinks(patent_no) {
// highlight the link lines to patent_no on the force map
  allPatentLinks.filter(function(d, i) {return (d.source.patent_no == patent_no || d.target.patent_no == patent_no);})
                .style({"stroke-width": function(d, i) {return (d.source.patent_no == patent_no) ? "3px" : "4px";}});
  allBiblioLinks.filter(function(d, i) {return (d.patentNode.patent_no == patent_no);})
                .style({"stroke-width": "3px"});
}

function unhighlightLinks(patent_no) {
// unhighlight the link lines to patent_no on the force map
  allPatentLinks.filter(function(d, i) {return (d.source.patent_no == patent_no || d.target.patent_no == patent_no);})
                .style({"stroke-width": "1px"});
  allBiblioLinks.filter(function(d, i) {return (d.patentNode.patent_no == patent_no);})
                .style({"stroke-width": "1px"});
}

function isMouseOverBiblio(divBib, coord) {
// part of routine used in transitioning an unpinned biblio back to its patentNode; use elementFromPoint and
// jQuery .find() to detemine if mouse at coordinates coord is over the divBib biblio
  var curElement = document.elementFromPoint(coord.x, coord.y);
  var $findElement = $(divBib.node()).find(curElement);          // jQuery here
  return ($findElement.size() > 0);
}

function makeBiblioPinned(divBib) {
// make the style changes associated with pinning a biblio; called from checkPinTrigger during dragging and
// from on_click_pin_btn event handler on the pin/unpin button
  divBib.datum().pinned = true;
  divBib.datum().detached = false;
  divBib.select("span.btn-pin-add")
        .classed({"btn-pin-add-display": true, "show-result-btn": true}); // show button; give it the pressed look
  divBib.select("path.pop1-arrow").classed({"make-hidden": true});      // hide the arrow pointing to the patent node
  divBib.select("circle.pop1-marker").classed({"ghost-marker": false}); // no dashed outline for node circle
}

function makeBiblioPinnedTop(divBib) {
// style changes that need to happen after dragging is finished; called from checkPinTrigger during dragging and
// from on_click_pin_btn event handler on the pin/unpin button
  divBib.select("div.pop1-top-capture").classed({"make-not-displayed": true});
  divBib.select("svg.pop1-arrow-circle").classed({"make-displayed": false});   // default is marker not displayed
}

function makeBiblioUnpinned(divBib) {
// make the style changes associated with unpinning a biblio; called from checkPinTrigger during dragging and
// from on_click_pin_btn event handler on the pin/unpin button
  divBib.datum().pinned = false;
  divBib.datum().detached = false;
  divBib.select("span.btn-pin-add")
        .classed({"btn-pin-add-display": false, "show-result-btn": false});// do not show button; give it unpressed look
  divBib.select("svg.pop1-arrow-circle").classed({"make-displayed": true});   // default is marker not displayed
  divBib.select("div.pop1-top-capture").classed({"make-not-displayed": false});  // back to default
  divBib.select("path.pop1-arrow").classed({"make-hidden": false});     // hide the arrow pointing to the patent node
  divBib.select("circle.pop1-marker").classed({"ghost-marker": false}); // no dashed outline for node circle
}

function makeBiblioDetached(divBib) {
// make the style changes associated with putting biblio in the detached state; called from checkPinTrigger
// when dragging a biblio or a patent node
  divBib.datum().pinned = false;
  divBib.datum().detached = true;
  divBib.select("span.btn-pin-add")
        .classed({"btn-pin-add-display": false, "show-result-btn": false});// do not show button; give it unpressed look
  divBib.select("svg.pop1-arrow-circle").classed({"make-displayed": true});   // default is marker not displayed
  divBib.select("div.pop1-top-capture").classed({"make-not-displayed": false});  // back to default
  divBib.select("path.pop1-arrow").classed({"make-hidden": false});     // hide the arrow pointing to the patent node
  divBib.select("circle.pop1-marker").classed({"ghost-marker": true});  // dashed outline for node circle
}

function addPopArrowCircleSVG(bibDiv) {
// add svg for arrow and node circle at top of biblio
  var bibArrowCircle = bibDiv.append("svg:svg").classed({"pop1-arrow-circle": true})
                 .attr({"data-patent": function(d, i) {return d.patent_no;}});
  bibArrowCircle.append("svg:path").classed({"pop1-arrow": true})
                .attr({"d": "M 0,0 L 0,8 8,0 z", "transform": "translate(12, 12) rotate(45)"});
  var bibMarker = bibArrowCircle.append("svg:g").classed({"pop1-marker": true})
                .attr({"transform": "translate(12, 12)"});
  bibMarker.append("svg:rect").attr({"x": "-7px", "y": "0px", "width": "14px", "height": "9px"});
  bibMarker.append("svg:circle").classed({"pop1-marker": true})
                .attr({"r": function(d, i) {return d.patentNode.markerRadius;},
                       "cx": "0px", "cy": "0px"});
}

function addPopTopBtns(bibDiv) {
// add svg for the buttons at the top right of the biblio
  var svgTopBtn = bibDiv.select("div.pop1-top-btns").append("svg:svg")
                        .classed({"pop1-top-btns-svg": true})
                        .attr({"width": "62px", "height": "22px"});
  // buttons have overlapping boundaries; use clippaths to divide the borders between buttons down the
  // middle, so half of the border belongs to one button and half to the other.
  var gPop1Front = svgTopBtn.append("svg:g").classed({"pop1-front": true}).attr({"clip-path": "url(#leftBtn)"});
  gPop1Front.append("svg:title").text("Bring to front");
  gPop1Front.append("svg:rect").classed({"pop1-top-btn": true, "pop1-front-btn": true})
            .attr({"x": "-10px", "y": "-10px", "rx": "7px", "ry": "7px", "width": "20px", "height": "20px"});
  gPop1Front.append("svg:rect").classed({"pop1-front-back-unfilled": true})
            .attr({"x": "-5px", "y": "-5px", "width": "7px", "height": "7px"});
  gPop1Front.append("svg:rect").classed({"pop1-front-back-filled": true})
            .attr({"x": "-2px", "y": "-2px", "width": "7px", "height": "7px"});
  // clip-path url's are in a <defs> section in the main svg element; for Firefox, there must be one unique
  // #id for each clipPath; Chrome uses the #id in the local svg block and applies in correctly to all
  // buttons; in Firefox, even if a #id is given in the local svg block, it will use the first #id found in
  // the entire document, which caused me much head-scratching before I figured it out.
  var gPop1Back = svgTopBtn.append("svg:g").classed({"pop1-back": true}).attr({"clip-path": "url(#midBtn)"});
  gPop1Back.append("svg:title").text("Send to back");
  gPop1Back.append("svg:rect").classed({"pop1-top-btn": true, "pop1-back-btn": true})
            .attr({"x": "-10px", "y": "-10px", "rx": "7px", "ry": "7px", "width": "20px", "height": "20px"});
  gPop1Back.append("svg:rect").classed({"pop1-front-back-filled": true})
            .attr({"x": "-5px", "y": "-5px", "width": "7px", "height": "7px"});
  gPop1Back.append("svg:rect").classed({"pop1-front-back-unfilled": true})
            .attr({"x": "-3px", "y": "-3px", "width": "8px", "height": "8px"});
  var gPop1Full = svgTopBtn.append("svg:g").classed({"pop1-full": true}).attr({"clip-path": "url(#rightBtn)"});
  gPop1Full.append("svg:title").text("Full view");
  gPop1Full.append("svg:rect").classed({"pop1-top-btn": true, "pop1-full-btn": true})
            .attr({"x": "-10px", "y": "-10px", "rx": "7px", "ry": "7px", "width": "20px", "height": "20px"});
  gPop1Full.append("svg:rect").classed({"pop1-full-rect": true})
            .attr({"x": "-5px", "y": "-4px", "width": "10px", "height": "8px"});
  var gPop1Short = svgTopBtn.append("svg:g").classed({"pop1-close": true, "make-not-displayed": true})
                            .attr({"clip-path": "url(#rightBtn)"});
  gPop1Short.append("svg:title").text("Popup view");
  gPop1Short.append("svg:rect").classed({"pop1-top-btn": true, "pop1-close-btn": true})
            .attr({"x": "-10px", "y": "-10px", "rx": "7px", "ry": "7px", "width": "20px", "height": "20px"});
  gPop1Short.append("svg:line").classed({"pop1-close-x1": true})
            .attr({"x1": "-8px", "y1": "0px", "x2": "8px", "y2": "0px"});
  gPop1Short.append("svg:line").classed({"pop1-close-x2": true})
            .attr({"x1": "-8px", "y1": "0px", "x2": "8px", "y2": "0px"});
}

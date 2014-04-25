// javascript functions for when Map page finishes loading

var DEBUG_FLAG = true;
$(window).on("load", on_main_page_load);
var clientCookie = "";

function debug() {
// use debug() instead of console.log() to control when logging to console occurs with DEBUG_FLAG.
  DEBUG_FLAG && console.log.apply(console, arguments);
}

function on_main_page_load() {

  // run the Yappee logo animation after a delay to give time for the browsers garbage collector to run, so the
  // animation is smoother
  clientCookie = $.cookie("yappee_cl");
  $.removeCookie("yappee_cl");
  addAdvancedSearchTabClickHandler();
  window.setTimeout(animateYappee, 700);

  function animateYappee() {
  // event handler for the jQuery document load event; trigger the transition to make the Yappee logo visible; then
  // assign the 'src' attribute on iframe. to load Google advanced patent search in the Search tab.

    // create a chained transition: the first transition moves the nodes from their initial random positions to their
    // final position; the second transition makes the letter segment lines visible; after the second transition is
    // done, proceed with getting the Google advanced patent search page and setting up tab popovers;
    // chain the transitions on the svg.yappee-graphic element using transition.transition().

    var svgYap = d3.select("svg.yappee-graphic");
    // make lines 'visible' (opacity is still 0).
    svgYap.selectAll("line.yappee-line").style({"visibility": "visible"});         // lines still have opacity 0
    // make nodes visible at their initially random positions.

    // make the text appear
    svgYap.selectAll("text.yappee-text").style({"visibility": "visible"});

    // transition nodes to their final positions over 1 sec.
    var svgYapTransition1 = svgYap.transition().duration(1000).ease("linear");
    svgYapTransition1.each(function() {
               svgYap.selectAll("circle.yappee-circle")
              // each node transition inherits the duration and ease of svgYapTransition1; if animation is choppy,
              // documentation suggests adding staggered delay on the elements
                     .transition()
                     .each("start", function() {d3.select(this).style({"visibility": "visible"});})
                     .attrTween("cx", function(d) {return d3.interpolate(d.startX, d.plotX);})
                     .attrTween("cy", function(d) {return d3.interpolate(d.startY, d.plotY);});
               });

    // wait 2 sec.
    var svgYapTransition2 = svgYapTransition1.transition().duration(2000);
    // Yappee text fades over 0.25 sec and at the same time ...
    var svgYapTransition3 = svgYapTransition2.transition().duration(250);
    svgYapTransition3.each(function() {
               svgYap.selectAll("text.yappee-text")
                     .transition()
                     .style({"opacity": 0});
               });

    // letter segments appear over 0.5 sec.
    var svgYapTransition4 = svgYapTransition2.transition().duration(500);
    svgYapTransition4.each(function() {
               svgYap.selectAll("line.yappee-line")
                     .transition()
                     .style({"opacity": 1});
               });

    // continue with some misc tasks
    svgYapTransition4.transition().each("end", on_yappee_logo_complete);
  }
}

function on_yappee_logo_complete() {
  d3.selectAll("text.yappee-text")
    .style({"visibility": "hidden",
            "opacity": 1});
  tabPopoverManager.setupInitialTabs();
}

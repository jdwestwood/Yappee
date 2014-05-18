// javascript functions for when Map page finishes loading

// if MINIFIED_DEBUG is specified in the minifyJS.js minifier assign DEBUG_FLAG to that value; otherwise assume that
// we are in development mode.
var DEBUG_FLAG = (typeof MINIFIED_DEBUG ==='undefined') ? true : MINIFIED_DEBUG;

function debug() {
// use debug() instead of console.log() to control when logging to console occurs with DEBUG_FLAG.
  DEBUG_FLAG && console.log.apply(console, arguments);
}

$(window).on("load", on_main_page_load);

// initialize cookie-related items
var clientCookie = "";
var cookieTracker = new CookieTracker();
var EPO_QUERY_DOMAIN = "ec2-54-218-108-62.us-west-2.compute.amazonaws.com:8081";
var EPO_QUERY_PATH = "/epoapi/biblio/";
var EPO_VERIFY_PATH = "/epoapi/jsverify/";

function CookieTracker() {
// class to maintain a list of jobs in progress that make HTTP requests to the server and therefore require that
// clientCookie be set.
  this.count = 0;
  this.start = function() {
    this.count += 1;
    debug("In cookieTracker, added a cookie for total count of " + this.count);
    $.cookie('yappee_cl', clientCookie);
  }
  this.end = function(timeOut) {
    var delayTime = (timeOut) ? timeOut : 0;
    this.count -= 1;
    debug("In cookieTracker, received end request with delay time of " + delayTime + " msec. New count is " + this.count);
    window.setTimeout(checkRemove.bind(this), delayTime);
  }

  function checkRemove() {
    if (this.count <= 0) {                               // remove cookie if no cookie jobs have been added in the meantime
      $.removeCookie('yappee_cl');
      // note the cookieTracker count can go negative due to mouse event handlers mousedown, keyup, blur calling
      // .end from related tabs; these events can be triggered multiple times without .start calls.
      debug("In cookieTracker, deleted a cookie for total count of " + this.count + "; will reset the count to zero.");
      this.count = 0;
    }
    else {
      debug("In cookieTracker, did not delete cookie due to total count of " + this.count);
    }
  }
}

// need to sync animation of Yappee graphic to (1) window load complete event from the browser and (2)
// the loading and setup of the HTML templates, which are loaded by jQuery.  Associate a jQuery
// Deferred object with the document and resolve when the window finishes loading.  The jQuery
// ajax methods return deferred objects.  Use $.when to coordinate the two tasks and animate the
// Yappee graphic when they are both done.
$(document).data("docDeferred", new $.Deferred());       // attach a Deferred object to the document; used by $.when below

function on_main_page_load() {
  // get a new clientCookie every time the page loads (the first time and anytime the user navigates to it using the
  // forward or backward arrows); need to wait until the page loads in case the 'yappee_id' cookie is also new;
  // query returns an empty string for the data, and sets the 'yappee_cl' session cookie.
  var getClientCookie = $.ajax({url: "/jsverify/",       // a jQuery Deferred object
          cache: false,
          error: function() {
                    $("body").html("")
                             .css({"visibility": "visible", "margin" : "1em 1em", "font-family": "monospace"});
                    $("body").html("Invalid session. Please reload Yappee.");}
         });

  var getEPOQueryCookie = $.ajax({url: "http://" + EPO_QUERY_DOMAIN + EPO_VERIFY_PATH,   // a jQuery Deferred object
          cache: false,
          crossDomain: true,
          xhrFields: {withCredentials: true},
          error: function() {
                    $("body").html("")
                             .css({"visibility": "visible", "margin" : "1em 1em", "font-family": "monospace"});
                    $("body").html("Cannot connect to EPO patent data server. Please try later.");}
         });

  $.when(getClientCookie, getEPOQueryCookie).done(on_jsverify_complete) 

  function on_jsverify_complete() {
  // callback for the GET requests for: (1) 'yappee_cl' cookie; this cookie is set in js for each request for Google data
  // from the server and removed immediately afterwards; purpose is to prevent queries from being passed on to Google if
  // the user manually types a yappee url into the browser; in that case the request will not be passed to Google because
  // the 'yappee_cl' cookie will not exist in the browser; (2) 'yappee_epo' cookie for the domain of the EPO patent data
  // server.
    $("body").css("visibility", "visible");
    clientCookie = $.cookie("yappee_cl");
    $.removeCookie("yappee_cl");
    debug("In on_jsverify_complete, got 'yappee_cl' cookie " + clientCookie);
    $(document).data("docDeferred").resolve();             // signal the window has finished loading; used by $.when below
  }
}

// create a deferred object from a jQuery .get request to load all the underscore.js templates; used by $.when below.
var templateQuery = $.get("/scripts/templates/templates.html", on_templates_loaded);

function on_templates_loaded(data) {
// callback for the $.get request for the underscore.js HTML templates
  $("body").append(data);                            // append the 'text/template' scripts so can reference them using _.template
  // for creating a new tab
  compiledNavTabTemplate = _.template( $("script#bs_nav-tab").html());
  compiledTabContentTemplate = _.template( $("script#bs_tab-pane").html());
  // for popovers, created in tab_setup.js
  compiledRelatedPopoverTitle = _.template( $("script#prior-art-popover-title").html());
  compiledRelatedPopoverContent = _.template( $("script#prior-art-popover-content").html());
  compiledPatentPopover = _.template( $("script#patent-info-popover").html());
  // for biblios on the force map, created in force_map_behavior.js
  compiledPop1Template = _.template( $("script#force-biblio").html());
  // for mapped and favorite patent lists on the Map page, created in map_fav_lists.js
  compiledMappedListEntryTemplate = _.template( $("script#mapped-list-entry-section").html());
  compiledFavoritesListEntryTemplate = _.template( $("script#favorites-list-entry-section").html());
  compiledPatentListBiblioTemplate = _.template( $("script#patent-list-patent-section").html());
  compiledPatentListCitationsTemplate = _.template( $("script#patent-list-reference-section").html());
  // for related pages, used in setup_related.js
  compiledPriorArtHeader = _.template( $("script#prior-art-table").html());
}

$.when(templateQuery, $(document).data("docDeferred")).done(on_done_templates_and_document);

function on_done_templates_and_document() {
// callback for the $.when; call the Yappee animation only when both the document is loaded and the templates
// have been loaded by a separate $.get request.
  addAdvancedSearchTabClickHandler();
  updateForceMap();
  // run the Yappee logo animation after a delay to give time for the browsers garbage collector to run, so the
  // animation is smoother.
  window.setTimeout(animateYappee, 700);
}

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

function on_yappee_logo_complete() {
  d3.selectAll("text.yappee-text")
    .style({"visibility": "hidden",
            "opacity": 1});
  tabPopoverManager.setupInitialTabs();
}

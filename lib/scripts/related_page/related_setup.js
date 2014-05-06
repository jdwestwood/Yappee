// create a tab for Google related patents when the user click on a Related link in a search tab or the Prior Art button
// in a patent tab.

var compiledPriorArtHeader;

function make_related_tab(related_url) {
  nRelatedTabs += 1;
  var link_match = rExp_patno_from_url.exec(unescape(related_url));        // javascript unescape() function to remove %2F
  var patent_no = link_match ? link_match[1] : '';
  var tab_name = 'Re-' + patent_no;
  var tab_id = "relatedTab_" + nRelatedTabs;
  var tab_content_id = "related_" + nRelatedTabs;
  var iframe_id = "gps_related_" + nRelatedTabs;
  var navTabHTML = compiledNavTabTemplate({tab_id: tab_id, tab_content_id: tab_content_id, tab_name: tab_name});
  var tabContentHTML = compiledTabContentTemplate({tab_content_id: tab_content_id, iframe_id: iframe_id,
                                                  iframe_width: 1220, iframe_height: googleIFrameHeight});
  $("div.tab-pane.active").after(tabContentHTML);
  $("ul#topTabs li.active").after(navTabHTML);        
  var htmlPriorArtHeader = compiledPriorArtHeader({patent_no: patent_no});
  var $iframe = $("iframe#" + iframe_id)
  $iframe.css("visibility", "hidden")
         .load(on_related_load);
  $.cookie("yappee_cl", clientCookie);
  $("iframe#" + iframe_id).attr("src", related_url);

  function on_related_load() {
    var $context = $(this).contents();
    $("head", $context).append($("script#search-term-table-style").html());    // append style for replacement page header
    // the main prior art patent list and parent patent info loads via javascript after rest of page loads; we need to detect
    // when those parts are populated with content; a hack to do this is to attach an animation to the div.r elements via css
    // see http://stackoverflow.com/questions/6997826/alternative-to-domnodeinserted
    $("body", $context).addClass("make-invisible");          // so user does not see the web page manipulations
    $("td.content-td", $context)
      .on('webkitAnimationStart', "div.r", on_divr_added);                                // Chrome animation event
    $("td.content-td", $context)
      .on('animationstart', "div.r", on_divr_added);                                      // Firefox animation event
    $("td.metadata-td", $context)                                                         // Chrome animation event
      .on('webkitAnimationStart', "div.metadata", {"tab_id": tab_id, "$context": $context}, on_divmeta_added);
    $("td.metadata-td", $context)                                                         // Firefox animation event
      .on('animationstart', "div.metadata", {"tab_id": tab_id, "$context": $context}, on_divmeta_added);
    process_links($context, "related");

    // generate click for prior art patents only
    // 11/25/2013: do not need to simulate click if append '#c=p' to the end of the related url; only the patents load now

    // delete the Google content at the top of the page down to div.main-content-wrapper
    deleteTopContent($("body", $context), $("div.main-content-wrapper", $context));
    $("body", $context).prepend($("script#page-header").html()); 
    $("span#jdw-top-row", $context).append(htmlPriorArtHeader);        // append html for the prior art page header
    $("div#footer", $context).remove();
    var aTab = $("a#" + tab_id);
    // attach on_tab_shown hander here. Firefox does not start animations until page is visible; Chrome starts them
    // when the HTML for the animated element is loaded; to avoid delay for the user, click on the new related tab
    // now and then wait for the div.r's and div.meta to load asynchronously; when click happens, the 'show' event
    // handler must already be attached so the popovers will be managed correctly.
    aTab.on('shown.bs.tab', tabPopoverManager.on_tab_shown.bind(tabPopoverManager));
    aTab.tab("show")                           // note that the div.r's and divmeta have not finished loading yet
    window.scrollTo(0,0);
    window.focus();
    window.setTimeout(function() {$iframe.css("visibility", "visible");}, 2000);
  }

  function on_divr_added(event) {
  // called for each div.r that is added; divr is 'this' for the event (a jQuery delegated event).
    var $divr = $(this),
        $divrContext = $divr.contents();
    deleteNonPatents();                                        // delete the result if it is not a patent
    process_links($divr, "related");
    var $span_t = $("span.t", $divr);
    if ($("span", $span_t).length == 1) {                      // if 'map' and 'favorites' buttons have not been added
      var $hideBtn = $("span.hide-result-btn", $span_t);       // the 'Hide' button on the original Google related page
      // put all css floated buttons before the patent link so they are rendered first and stay on the same line;
      // elements are floated in the order they are added, so to make the buttons appear in 'map', 'favorite', 'hide'
      // order, arrange them in reverse order in the HTML document.
      $hideBtn.addClass("btn-original").attr("title", "Hide")
              .after($("script#related-art-page-button-content").html());  // add the 'map' and 'favorite' buttons
      var btnMap = $("span.btn-map-add", $span_t);
      var patent_no = getPatentURL_No(btnMap, $divrContext, "related").patent_no;
      setupMapFavButtons($span_t, $divrContext, "related", patent_no);
    }

    function deleteNonPatents() {
    // check the cite element of the div.r to see if it is a patent link; if not, delete it; stop looking after
    // encountering the first patent link by return false per jQuery documentation.
      var $cite = $divr.find("cite");
      if ($cite.size() > 0) {
        var citeText = $cite.text();
        var link_match = rExp_patno_from_url.exec(citeText);
        if (!link_match) {
          $divr.remove();
        }
      }
      else {
        $divr.remove();
      }
    }
  }

  function on_divmeta_added(event) {
  // the divmeta div; the page_type is 'related-root' - the root patent of the prior art search
    var $divmeta = $(this),
        $context = event.data.$context
        tab_id = event.data.tab_id;
    process_links($divmeta, "related-root");
    // the 'Discuss the patent' button ('patent' misspelled as 'parent' in the div id!)
    $("div#discuss-this-parent", $context).remove();
    // put all css floated buttons before the patent link so they are rendered first and stay on the same line;
    $("div.metadata h2", $context).prepend($("script#related-art-page-button-content").html());
    var btnMap = $("div.metadata span.btn-map-add", $context);

    // event handlers for the 'More Patents Results' button at the bottom of the related page.  Purpose is to
    // set the 'yappee_cl' cookie before the page makes requests for new /related/rpc data, and then remove the
    // cookie after the request has been sent.
    $("div.jfk-button.jfk-button-action", $context)
                        .on("mousedown.loadGoogle", on_mousedown_related_items)
                        .on("mouseout.loadGoogle", on_mouseout_related_items);

    // event handlers for the Search Terms checkboxes, delete buttons, and search term text items. Purpose is to
    // set the 'yappee_cl' cookie before the page makes requests for new /related/rpc data, and then remove the
    // cookie after the request has been sent.  Note that these items respond differently to mouse events and
    // require different handling strategy.
    $leftNav = $("div#left-nav-container", $context)
     .on("mousedown.loadGoogle", "span.jfk-checkbox, span.search-term-text, span.delete-term-btn",
               function(event) {$(event.target).data("mousedown", "true");})
     .on("mouseup.loadGoogle", "span.jfk-checkbox, span.search-term-text, span.delete-term-btn", on_mouseup_related_items)
     .on("mouseout.loadGoogle", "span.jfk-checkbox, span.search-term-text, span.delete-term-btn", on_mouseout_related_items)
     .on("keydown.loadGoogle", "input.jfk-textinput", on_keydown_related_items)                     // input boxes
     .on("keyup.loadGoogle", "input.jfk-textinput", on_keyup_related_items);
    // must attach the blur event handler directly to the input elements; does not work if delegate from div#left-nav-container.
    $("input.jfk-textinput", $context).on("blur.loadGoogle", on_blur_related_items);
    // need a mouseup handler on the entire document to reset the mousedown data in the Search Term elements
    $($context).on("mouseup.loadGoogle", {"leftNav": $leftNav}, function(event) {
          $leftNav.find("span.jfk-checkbox, span.search-term-text, span.delete-term-btn").data("mousedown", "false");}); 

    patent_no = getPatentURL_No(btnMap, $context, "related-root").patent_no;
    setupMapFavButtons($divmeta, $context, "related-root", patent_no);
    tabPopoverManager.setupPriorArtTabPopover(tab_id, $context);   // set up the popover for the tab for this page
    window.setTimeout(function() {$.removeCookie("yappee_cl");}, 1000);
    $("body", $context).removeClass("make-invisible");
    $("a#" + tab_id).click();
  }

  function on_mousedown_related_items(event) {
  // see documentation in on_mousedown_related_items; event handler for div.jfk-button.goog-inline-block.jfk-button-action
  // request triggered by mousedown with no mouseout before mouseup
    $.cookie("yappee_cl", clientCookie);
  }

  function on_mouseout_related_items(event) {
  // mouseout event handler for the checkboxes, delete buttons, search term text in the Search Terms area on
  // the left side of a related page and the 'More Patents Results' button at the bottom of the page;
  // 'clicking' on these items causes the page to request data from /related/rpc; need to set the clientCookie
  // for the request to be successsful on the server; elements for event in the Search Terms area are
  // span.jfk-checkbox.goog-inline-block, span.search-term-text, and span.delete-term-btn; element for the
  // 'More Patents Results' button is div.jfk-button.goog-inline-block.jfk-button-action; works in conjunction
  // with the mouse event handlers to add and remove the cookie; note that on_divmeta_added is not triggered
  // again when the results are modified - the mouseout handler takes care of removing the clientCookie
  // in all cases.
      $.removeCookie("yappee_cl");
  }

  function on_mouseup_related_items(event) {
  // see documentation in on_mousedown_related_items event handler for elements in the Search Terms area:
  // span.jfk-checkbox.goog-inline-block, span.search-term-text, and span.delete-term-btn. request triggered by
  // mousedown over the element, followed by mouseup on the element, with mouse being able to go anywhere else
  // in between as long as the mouse is still down. 
    var $target = $(event.target);
    if ($target.data("mousedown") == "true") {
      $.cookie("yappee_cl", clientCookie);
      // event handler attached to the document takes care of resetting 'mousedown' to false.
    }
  }

  function on_keydown_related_items(event) {
  // keydown event handler for the input boxes in the Search Terms area on the left side of a related page; the
  // handler sets the yappee_cl cookie, to be ready for when the page requests data from /related/rpc on the keyup
  // event; need to set the clientCookie for the request to be successsful on the server; elements for keydown event
  // in the Search Terms area are input.jfk-textinput.
      // set cookie when user types the first letter
      $.cookie("yappee_cl", clientCookie);
  }

  function on_blur_related_items(event) {
  // see documentation for the on_keydown_related items and on_keyup_related items handlers; the blur event fires when
  // user clicks outside the input box.
    $.removeCookie("yappee_cl");
  }

  function on_keyup_related_items(event) {
  // keyup event handler for the input boxes in the Search Terms area on the left side of a related page; Google keyup
  // handler on input boxes triggers request to related/rpc for more patent data; Google handler is called first, so use
  // this keyup handler to remove the yappee_cl cookie; need to set the clientCookie for the request to be successsful
  // on the server; elements for the keyup event in the Search Terms area are input.jfk-textinput.
    // remove cookie when user types enter or when user clicks outside the input box (the blur event handler)
    if (event.keyCode == 13) {
      $.removeCookie("yappee_cl");
    }
  }
}

/*
function simulateClick(element, eventType, contextWindow) {
// similate a mouse event 'type' on the 'element' in the 'contextWindow'
// 11/25/2013: no longer need to use this function to load only patents in the related window;
// append "#c=p" to the end of the related url
  var event = new MouseEvent(eventType, {
    'view': contextWindow,
    'bubbles': true,
    'cancelable': true
  });
  var canceled = !element.dispatchEvent(event);
  if (canceled) {
  // A handler called preventDefault.
  }
  else {
  // None of the handlers called preventDefault.
  }
}
*/

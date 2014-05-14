// create a new patent tab or go to an existing one; process the patent page once its loaded

function patentTab(patent_url, patentLabel) {
// check if a tab for patentLabel exists; if not, query Google at patent_url and create it; call optional callback
// on_patent_tab_complete when done
  var patentTabDeferred = new $.Deferred();
  var $aTab = $("a[data-tabname='" + patentLabel + "']");    // check if patent tab for this patent already exists
  if ($aTab.length == 0) {
    make_patent_tab(patent_url, patentLabel);
  }
  else {
    $aTab.click();
    var patent_no = $aTab.attr("data-patent");
    patentTabDeferred.resolve(patent_no);                    // callback with full patent_no
  }
  return patentTabDeferred.promise();

  function make_patent_tab(patent_url, patentLabel) {
  // add HTML for the new patent tab and label it with patentLabel; set up the iframe and load it with the Google
  // patent document at patent_url.
    nPatentTabs += 1;
    var tab_id = "patTab_" + nPatentTabs;
    var tab_content_id = "patent_" + nPatentTabs;
    var iframe_id = "gps_patent_" + nPatentTabs;
    var navTabHTML = compiledNavTabTemplate({tab_id: tab_id, tab_content_id: tab_content_id, tab_name: patentLabel});
    var tabContentHTML = compiledTabContentTemplate({tab_content_id: tab_content_id, iframe_id: iframe_id,
                                                     iframe_width: 1050, iframe_height: googleIFrameHeight});
    var tabButtonHTML = $("script#tab-buttons").html();
    $("div.tab-pane.active").after(tabContentHTML);
    $("ul#topTabs li.active").after(navTabHTML);
    var $aTab = $("a#" + tab_id);
    $aTab.find("button.close-tab").on("click", tabPopoverManager.deleteTab);  // attach click handler to delete button
    $aTab.append(tabButtonHTML);                          // add the map and favorite buttons
    var $iframe = $("iframe#" + iframe_id)
    $iframe.css("visibility", "hidden")
           .on("load", on_patent_load)
           .on("error", on_patent_load_error);
    cookieTracker.start();
    $("iframe#" + iframe_id).attr("src", patent_url);

    function on_patent_load_error(event) {
    // error handler if iframe does not load due to bad Google patent link
      cookieTracker.end(500);
      patentTabDeferred.reject();
      debug("In on_patent_load_error, error event is ", event);
    }

    function on_patent_load() {
    // modify the HTML of the Google patent page after it loads
      var $context = $(this).contents();
      $("head", $context).append($("script#search-term-table-style").html());    // append style for replacement page header
      $("div#pocs", $context).remove();                  // 4/2/2014 div#pocs does not seem to exist any more
      process_links($context, "patent");
      process_patent_button_bar($context);
      $("a[href='/patents']", $context).remove();        // link to basic patent search
      $("div#footer_table", $context).remove();          // links at the bottom of the page
      $("body *", $context).each(deleteTopContent);      // delete undesired top content
      $("body", $context).prepend($("script#page-header").html());  // replace with my own

      // Attach special click event handlers for the 'Application', 'Grant', and 'Also published as' buttons
      $("div.viewport-chrome-toolbar div:contains('Application')", $context)
        .each( function(index) {$(this).on("click", {index: index}, on_click_Application);} );  // Application button(s)
      $("div.viewport-chrome-toolbar div:contains('Grant')", $context)
        .each( function(index) {$(this).on("click", {index: index}, on_click_Grant);} );        // Grant button
      $("td.patent-bibdata-heading:contains('Also published as') ~ td span.patent-bibdata-value > a", $context)
        .off("click", on_click_new_patent_url).on("click", on_click_AlsoPublishedAs);

      // Remove the hyperlinks for translating the patent, but keep the text
      $("span.notice-section > a", $context).contents().unwrap();

      // remove the Export Citations row in the biblio table
      $("table.patent-bibdata td.patent-bibdata-heading:contains('Export')", $context).closest("tr").remove();
      $("tr.patent-internal-links", $context).on("click", on_click_patent_internal_links);

      // make image links in div.modal-dialog work; for some reason when the patent page is in an iframe, and the
      // user has clicked on a patent figure thumbnail, the 'Original Image' links that should open the image in
      // a new window (using the target='_blank' attribute) stop working; since 'Original Image' links are not
      // present when the patent page is loaded, attach the event handler to the div.modal-dialog ancestor.
      $("div.modal-dialog", $context).on("click", "a.patent-lightbox-fullsize-link", on_click_OriginalImage);

      // set up the popover for the patent tab; parse the doc to get the full patent_no.
      var patent_no = tabPopoverManager.setupPatentTab(tab_id, $context);
      $aTab.tab("show");
      window.scrollTo(0,0);
      window.focus();
      cookieTracker.end(1500);
      window.setTimeout(function() {$iframe.css("visibility", "visible");}, 1000);
      patentTabDeferred.resolve(patent_no);              // callback with the full patent_no

      function process_patent_button_bar($context) {
      // keep only the 'Application', 'Grant', 'Find prior art', 'View PDF', and 'Download PDF' buttons along the top
      // of the patent; remove the gearbox button; remove Google's mousedown/mouseup listeners; add mouse event listeners
      // of my own so buttons function correctly.
        $("div.goog-inline-block.jfk-button", $context).each(function() {
          var button_text = $(this).text();
          // Remove any language translation buttons, 'Discuss this patent'
          if (button_text != 'Application' && button_text != 'Grant' && button_text != 'Find prior art'
            && button_text != 'View PDF' && button_text != 'Download PDF') $(this).remove();
        });
        $("div[role='button'] img[src*='settings.png']", $context).parent().parent().remove();  // gearbox settings button
        var origLeftToolbarButtons = $("div#left-toolbar-buttons", $context);
        var origRightToolbar = $("div#right-toolbar-buttons div.viewport-chrome-toolbar", $context);
        // replace divs with themselves as the only way to remove anonymous mousedown and mouseup event listeners;
        // clone('false') = do not clone event listeners;
        origRightToolbar.replaceWith(origRightToolbar.clone('false'));
        var newRightToolbar = $("div#right-toolbar-buttons div.viewport-chrome-toolbar", $context);
        newRightToolbar.on('mousedown', divMouseDown);
        newRightToolbar.on('click', on_click_patent_div_button);

        function on_click_patent_div_button(event) {
        // so the 'Find prior art', 'View PDF', and 'Download PDF' buttons work correctly
          switch ($(event.target).text()) {
            case "Find prior art":
              var related_url = $("a#appbar-patents-prior-art-finder-link", $context).attr("href");
                make_related_tab(related_url + "#c=p");                  // '#c=p' to show patents only
              break;
            case "View PDF":
              var external_url = $("a#appbar-read-patent-link", $context).attr("href");
              window.open(external_url);
              break;
            case "Download PDF":
              var external_url = $("a#appbar-download-pdf-link", $context).attr("href");
              window.open(external_url);
              break;
            default:
          }
        }
      }

      function deleteTopContent() {
      // .each jQuery function to process the top content of the patent page; 'this' is each child of the body element;
      // return false halts the .each function calls
        var $elem = $(this);
        switch ($elem.prop("tagName")) {
          case "TABLE":
            return false;                                 // stop iterating through the children of the body element
            break;
          case "SCRIPT":
            return;
          default:
            if (!$elem.hasClass("kd-appbar")) {           // remove everything except the div.kd-appbar element
              $elem.remove();
            }
        }
      }

      function on_click_Application(event) {
      // do not call event.stopPropagation() so Google's update code will run; a new on_patent_load event will be
      // triggered when the iframe loads with new data.
        $iframe.css("visibility", "hidden");
        cookieTracker.start();
        var $context = $(this.ownerDocument);
        var thisIndex = event.data.index;                       // index of element the triggered the event
        var application_url = $("a[data-label='Application']", $context).eq(thisIndex).attr("href");
        var link_match = rExp_patno_from_url.exec(application_url);
        var application_no = link_match ? link_match[1] : '';
        $("ul#topTabs li.active > a > span").text(application_no);     // note we are not changing the id of the tab
        window.scrollTo(0,0);
      }

      function on_click_Grant(event) {
      // do not call event.stopPropagation() so Google's update code will run; a new on_patent_load event will be
      // triggered when the iframe loads with new data.
        $iframe.css("visibility", "hidden");
        cookieTracker.start();
        var $context = $(this.ownerDocument);
        var thisIndex = event.data.index;
        var grant_url = $("a[data-label='Grant']", $context).eq(thisIndex).attr("href");
        var link_match = rExp_patno_from_url.exec(grant_url);
        var grant_no = link_match ? link_match[1] : '';
        $("ul#topTabs li.active > a > span").text(grant_no);     // note we are not changing the id of the tab
        window.scrollTo(0,0);
      }

      function on_click_AlsoPublishedAs(event) {
        $iframe.css("visibility", "hidden");
        var $context = $(this.ownerDocument.body);
        var grant_url = $(this).attr("href");
        var link_match = rExp_patno_from_url.exec(grant_url);
        var grant_no = link_match ? link_match[1] : '';
        // if patent will not open in separate browser tab, change the caption of the current application tab
        if (!external_URLs.some( function(external_URL) {return grant_url.search(external_URL) >= 0 ? true : false;})) {  
          cookieTracker.start();
          $("ul#topTabs li.active > a > span").text(grant_no);
        }
        window.scrollTo(0,0);
      }

      function on_click_OriginalImage(event) {
      // when user clicks the 'Original Image' link on a patent figure being shown after clicking a thumbnail on the
      // patent page; this handler is identical to on_click_external in shared/shared_google.js.
        event.preventDefault();
        event.stopPropagation();
        var url = $(this).attr("href");
        window.open(url);
      }
    }
  }

  function on_click_patent_internal_links(event) {
  // click event handler for links to lists references on a patent page; main page scrolls down and hides the tabs at
  // the top of the page; this function scrolls the main page back up to the top so tabs are visible.
    var $target = $(event.target);
    if ($target.prop("tagName") == "A") {
      window.setTimeout(function() {window.scrollTo(0,0);}, 30)
    }
  }
}

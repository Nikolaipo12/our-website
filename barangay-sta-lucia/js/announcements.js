/* Public announcement lists, rendered from the resident database. */
(function (global) {
  "use strict";

  var BSL = global.BSL;
  if (!BSL) return;

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function readTime(body) {
    var words = String(body || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  function excerpt(text, maxLength) {
    var value = String(text || "").trim();
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
  }

  function announcementCard(announcement, withDialog) {
    var card = make("article", "notice");
    card.setAttribute("data-category", announcement.category);

    card.appendChild(make("span", "pill", announcement.category));
    card.appendChild(make("h3", null, announcement.title));
    card.appendChild(
      make("div", "meta", "Post date: " + BSL.formatDate(announcement.publishedAt))
    );
    card.appendChild(make("p", null, excerpt(announcement.body, 190)));

    var footer = make("div", "footer-row");
    footer.appendChild(make("span", null, readTime(announcement.body) + " min read"));

    if (withDialog) {
      var button = make("button", "small-button", "Read more");
      button.type = "button";
      button.setAttribute("data-read-announcement", announcement.id);
      footer.appendChild(button);
    }

    card.appendChild(footer);
    return card;
  }

  function emptyNotice(message) {
    var box = make("div", "panel-empty announcement-empty");
    box.appendChild(make("strong", null, "No announcements yet"));
    box.appendChild(make("p", null, message || "New barangay announcements will appear here."));
    return box;
  }

  function safeList() {
    try {
      return BSL.listAnnouncements();
    } catch (error) {
      return [];
    }
  }

  function renderPage() {
    var grid = document.getElementById("announcements-grid");
    if (!grid) return;

    var announcements = safeList();
    grid.textContent = "";

    if (announcements.length === 0) {
      grid.appendChild(emptyNotice("Please check back soon for community updates."));
      return;
    }

    var fragment = document.createDocumentFragment();
    announcements.forEach(function (announcement) {
      fragment.appendChild(announcementCard(announcement, true));
    });
    grid.appendChild(fragment);
  }

  function renderRecent() {
    var grid = document.getElementById("recent-announcements");
    if (!grid) return;

    var announcements = safeList().slice(0, 3);
    grid.textContent = "";

    if (announcements.length === 0) {
      grid.appendChild(emptyNotice("New community updates will appear here."));
      return;
    }

    var fragment = document.createDocumentFragment();
    announcements.forEach(function (announcement) {
      fragment.appendChild(announcementCard(announcement, false));
    });
    grid.appendChild(fragment);
  }

  function initDialog() {
    var dialog = document.getElementById("announcement-dialog");
    if (!dialog) return;

    var title = document.getElementById("announcement-detail-title");
    var category = document.getElementById("announcement-detail-category");
    var meta = document.getElementById("announcement-detail-meta");
    var body = document.getElementById("announcement-detail-body");

    function closeDialog() {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    document.addEventListener("click", function (event) {
      var button = event.target.closest("[data-read-announcement]");
      if (!button) return;

      var id = button.getAttribute("data-read-announcement");
      var announcement = safeList().filter(function (item) {
        return item.id === id;
      })[0];
      if (!announcement) return;

      title.textContent = announcement.title;
      category.textContent = announcement.category;
      meta.textContent =
        "Posted " +
        BSL.formatDate(announcement.publishedAt) +
        " · " +
        readTime(announcement.body) +
        " min read";
      body.textContent = announcement.body;

      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });

    Array.prototype.forEach.call(
      dialog.querySelectorAll("[data-close-announcement]"),
      function (button) {
        button.addEventListener("click", closeDialog);
      }
    );

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog();
    });
  }

  renderPage();
  renderRecent();
  initDialog();
})(window);

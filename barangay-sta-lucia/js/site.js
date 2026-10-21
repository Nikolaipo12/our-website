/* Shared header behaviour and page transitions. */
(function (global) {
  "use strict";

  var BSL = global.BSL;
  var user = BSL ? BSL.getCurrentUser() : null;
  var isPortalPage = document.body.getAttribute("data-page") === "portal";

  document.querySelectorAll('a.cta-button[href="portal.html"]').forEach(function (link) {
    if (user) {
      link.textContent = "My Portal";
    } else if (!isPortalPage) {
      link.textContent = "Resident Login";
    }
  });

  var body = document.body;
  var reduceMotion =
    typeof global.matchMedia === "function" &&
    global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var leaving = false;

  /* ---------- Shared confirmation dialog ---------- */

  var confirmDialog = null;
  var confirmResolve = null;

  function buildConfirmDialog() {
    var dialog = document.createElement("dialog");
    dialog.className = "form-dialog confirm-dialog";
    dialog.id = "site-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "site-confirm-title");
    dialog.setAttribute("aria-describedby", "site-confirm-message");

    var head = document.createElement("div");
    head.className = "dialog-head";

    var headText = document.createElement("div");
    var tag = document.createElement("span");
    tag.className = "pill";
    tag.id = "site-confirm-tag";
    var title = document.createElement("h2");
    title.id = "site-confirm-title";
    var message = document.createElement("p");
    message.id = "site-confirm-message";
    headText.appendChild(tag);
    headText.appendChild(title);
    headText.appendChild(message);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "dialog-close";
    close.setAttribute("aria-label", "Close confirmation");
    close.setAttribute("data-confirm-cancel", "");
    close.textContent = "×";

    head.appendChild(headText);
    head.appendChild(close);

    var content = document.createElement("div");
    content.className = "dialog-body";
    var item = document.createElement("div");
    item.className = "confirmation-item";
    item.id = "site-confirm-item";
    content.appendChild(item);

    var actions = document.createElement("div");
    actions.className = "dialog-actions";

    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary-button";
    cancel.setAttribute("data-confirm-cancel", "");
    cancel.textContent = "Keep";

    var accept = document.createElement("button");
    accept.type = "button";
    accept.className = "form-button danger-button";
    accept.setAttribute("data-confirm-accept", "");
    accept.textContent = "Confirm";

    actions.appendChild(cancel);
    actions.appendChild(accept);

    dialog.appendChild(head);
    dialog.appendChild(content);
    dialog.appendChild(actions);

    function settle(result) {
      if (!confirmResolve) return;
      var resolve = confirmResolve;
      confirmResolve = null;
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      resolve(result);
    }

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) settle(false);
    });

    dialog.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      settle(false);
    });

    // Covers the browser's native close behaviour.
    dialog.addEventListener("close", function () {
      if (!confirmResolve) return;
      var resolve = confirmResolve;
      confirmResolve = null;
      resolve(false);
    });

    Array.prototype.forEach.call(
      dialog.querySelectorAll("[data-confirm-cancel]"),
      function (button) {
        button.addEventListener("click", function () {
          settle(false);
        });
      }
    );

    accept.addEventListener("click", function () {
      settle(true);
    });

    document.body.appendChild(dialog);
    return dialog;
  }

  function showConfirmDialog(options) {
    var settings = options || {};

    return new Promise(function (resolve) {
      if (!confirmDialog) confirmDialog = buildConfirmDialog();

      if (typeof confirmDialog.showModal !== "function") {
        resolve(global.confirm(settings.message || settings.title || "Are you sure?"));
        return;
      }

      var tag = confirmDialog.querySelector("#site-confirm-tag");
      var title = confirmDialog.querySelector("#site-confirm-title");
      var message = confirmDialog.querySelector("#site-confirm-message");
      var item = confirmDialog.querySelector("#site-confirm-item");
      var cancel = confirmDialog.querySelector("[data-confirm-cancel].secondary-button");
      var accept = confirmDialog.querySelector("[data-confirm-accept]");

      tag.textContent = settings.tag || "Please confirm";
      tag.style.display = settings.tag ? "" : "none";
      title.textContent = settings.title || "Are you sure?";
      message.textContent = settings.message || "";
      message.style.display = settings.message ? "" : "none";
      item.textContent = settings.item || "";
      item.style.display = settings.item ? "" : "none";
      cancel.textContent = settings.cancelLabel || "Keep";
      accept.textContent = settings.confirmLabel || "Confirm";

      confirmResolve = resolve;
      confirmDialog.showModal();
      cancel.focus();
    });
  }

  global.showConfirmDialog = showConfirmDialog;

  /* ---------- Mobile navigation ---------- */

  var navToggle = document.getElementById("nav-toggle");
  var menuToggle = document.querySelector(".menu-toggle");
  var mobileMenu = document.querySelector(".mobile-menu");
  var navClose = document.querySelector(".mobile-menu-close");

  if (navToggle && menuToggle && mobileMenu) {
    if (!mobileMenu.id) mobileMenu.id = "mobile-menu";

    // The checkbox is only the CSS state carrier; the labels are the controls.
    navToggle.setAttribute("tabindex", "-1");

    menuToggle.setAttribute("role", "button");
    menuToggle.setAttribute("tabindex", "0");
    menuToggle.setAttribute("aria-controls", mobileMenu.id);

    if (navClose) {
      navClose.setAttribute("role", "button");
      navClose.setAttribute("tabindex", "0");
    }

    var focusMenuOnOpen = false;
    var desktopQuery = global.matchMedia("(min-width: 1181px)");

    function setMenuState(open, options) {
      var settings = options || {};
      var isOpen = !!open;

      navToggle.checked = isOpen;
      document.body.classList.toggle("menu-open", isOpen);

      menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");

      if (
        !isOpen &&
        (mobileMenu.contains(document.activeElement) || document.activeElement === navToggle) &&
        menuToggle.offsetParent !== null
      ) {
        menuToggle.focus({ preventScroll: true });
      }

      mobileMenu.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if ("inert" in mobileMenu) mobileMenu.inert = !isOpen;

      if (isOpen && settings.focus) {
        global.setTimeout(function () {
          if (!navToggle.checked) return;
          var first = navClose || mobileMenu.querySelector("a");
          if (first) first.focus({ preventScroll: true });
        }, 80);
      }
    }

    function closeMenu() {
      setMenuState(false, { focus: false });
    }

    // Always start closed, even when the browser restores form state.
    setMenuState(false, { focus: false });

    navToggle.addEventListener("change", function () {
      var opened = navToggle.checked;
      setMenuState(opened, {
        focus: focusMenuOnOpen || (opened && document.activeElement === navToggle)
      });
      focusMenuOnOpen = false;
    });

    menuToggle.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      focusMenuOnOpen = true;
      setMenuState(!navToggle.checked, { focus: true });
      focusMenuOnOpen = false;
    });

    if (navClose) {
      navClose.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        closeMenu();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !navToggle.checked) return;
      event.preventDefault();
      closeMenu();
    });

    mobileMenu.addEventListener("click", function (event) {
      var link = event.target.closest ? event.target.closest("a") : null;
      if (link) closeMenu();
    });

    // The scrim is a label; close explicitly and suppress its default toggle.
    document.addEventListener("click", function (event) {
      if (!navToggle.checked) return;
      if (
        event.target === navToggle ||
        mobileMenu.contains(event.target) ||
        menuToggle.contains(event.target)
      ) {
        return;
      }
      if (event.target.closest && event.target.closest(".nav-scrim")) {
        event.preventDefault();
      }
      closeMenu();
    });

    // Keep keyboard focus inside the open panel.
    mobileMenu.addEventListener("keydown", function (event) {
      if (event.key !== "Tab" || !navToggle.checked) return;

      var focusables = Array.prototype.filter.call(
        mobileMenu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        function (element) {
          return element.offsetParent !== null;
        }
      );
      if (!focusables.length) return;

      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    function handleDesktopChange(event) {
      if (event.matches && navToggle.checked) closeMenu();
    }

    if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", handleDesktopChange);
    else if (desktopQuery.addListener) desktopQuery.addListener(handleDesktopChange);

    global.addEventListener("pageshow", function () {
      setMenuState(false, { focus: false });
    });
  }

  if (!body) return;

  // Safety net for browsers or background tabs that pause CSS animations:
  // once the entrance should be finished, settle the curtain and content.
  global.setTimeout(function () {
    body.classList.add("page-ready");
  }, 700);

  if (reduceMotion) return;

  function clearLeavingState() {
    leaving = false;
    body.classList.remove("is-leaving");
  }

  // Restore a page normally when it comes back from the browser cache.
  global.addEventListener("pageshow", clearLeavingState);

  document.addEventListener("click", function (event) {
    if (leaving || event.defaultPrevented) return;
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    var link = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download") || link.hasAttribute("data-no-transition")) return;

    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;

    var destination;
    try {
      destination = new URL(link.href, global.location.href);
    } catch (error) {
      return;
    }

    if (
      destination.protocol !== "http:" &&
      destination.protocol !== "https:" &&
      destination.protocol !== "file:"
    ) {
      return;
    }
    if (destination.origin !== global.location.origin) return;

    // Let same-page anchors scroll normally instead of fading the page out.
    if (
      destination.pathname === global.location.pathname &&
      destination.search === global.location.search
    ) {
      return;
    }

    event.preventDefault();
    leaving = true;
    body.classList.add("is-leaving");

    global.setTimeout(function () {
      global.location.href = destination.href;
    }, 360);
  });
})(window);

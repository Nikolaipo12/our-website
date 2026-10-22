/* Login and registration page logic. */
(function (global) {
  "use strict";

  var BSL = global.BSL;
  if (!BSL) return;

  var allowedPages = [
    "index.html",
    "announcements.html",
    "services.html",
    "emergency.html",
    "officials.html",
    "concerns.html",
    "portal.html",
    "admin.html"
  ];

  var alertEl = document.getElementById("auth-alert");
  var loginForm = document.getElementById("login-form");
  var registerForm = document.getElementById("register-form");
  var loginSubmit = document.getElementById("login-submit");
  var registerSubmit = document.getElementById("register-submit");
  var panelLogin = document.getElementById("panel-login");
  var panelRegister = document.getElementById("panel-register");
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll("[data-auth-tab]"));
  var authWrap = document.querySelector(".auth-wrap");
  var authHeightAnimation = null;
  var authModeInitialized = false;
  var currentMode = "login";

  function animateAuthHeight(startHeight, endHeight) {
    if (!authWrap || !authWrap.animate) return;
    if (global.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!(endHeight > 0) || Math.abs(endHeight - startHeight) < 1) return;

    authHeightAnimation = authWrap.animate(
      [{ height: startHeight + "px" }, { height: endHeight + "px" }],
      { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
    authHeightAnimation.onfinish = function () {
      authHeightAnimation = null;
    };
  }

  function safeNext(value) {
    var raw = String(value || "").trim();
    if (!raw) return "portal.html";

    var parts = raw.split("#");
    var page = parts[0];
    if (allowedPages.indexOf(page) === -1) return "portal.html";

    var hash = parts[1] ? "#" + parts[1].replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "";
    return page + hash;
  }

  var nextPage = safeNext(new URLSearchParams(global.location.search).get("next"));

  // Someone who is already signed in should go straight to their destination.
  if (BSL.getCurrentUser()) {
    global.location.replace(nextPage);
    return;
  }

  if (!BSL.storageAvailable()) {
    showAlert(
      "This browser has blocked local storage, so accounts cannot be read or saved. Allow site data for this page, then reload.",
      "error"
    );
    loginSubmit.disabled = true;
    registerSubmit.disabled = true;
  } else if (!global.crypto || !global.crypto.subtle) {
    showAlert(
      "This browser cannot securely process passwords. Please open the site in an updated version of Chrome, Edge, Firefox, or Safari.",
      "error"
    );
    loginSubmit.disabled = true;
    registerSubmit.disabled = true;
  }

  var pendingFlash = BSL.consumeFlash();
  if (pendingFlash && pendingFlash.message) {
    showAlert(pendingFlash.message, pendingFlash.type || "info");
  }

  function showAlert(message, type) {
    alertEl.textContent = message;
    alertEl.className = "alert alert-" + (type || "error");
    alertEl.hidden = false;
    alertEl.focus({ preventScroll: true });
  }

  function clearAlert() {
    alertEl.hidden = true;
    alertEl.textContent = "";
  }

  function setBusy(button, busy, busyLabel) {
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = busyLabel;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  function setMode(mode, focusTab) {
    var nextMode = mode === "register" ? "register" : "login";
    var changing = authModeInitialized && nextMode !== currentMode;
    var startHeight = changing && authWrap ? authWrap.getBoundingClientRect().height : 0;

    if (changing && authHeightAnimation) {
      authHeightAnimation.cancel();
      authHeightAnimation = null;
    }

    currentMode = nextMode;
    var register = currentMode === "register";

    tabButtons.forEach(function (button) {
      var selected = button.getAttribute("data-auth-tab") === currentMode;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) button.focus();
    });

    panelLogin.hidden = register;
    panelRegister.hidden = !register;
    document.title =
      (register ? "Create Account" : "Resident Login") + " · Barangay Sta. Lucia";
    clearAlert();

    if (changing && authWrap) {
      animateAuthHeight(startHeight, authWrap.getBoundingClientRect().height);
    }
    authModeInitialized = true;
  }

  tabButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setMode(button.getAttribute("data-auth-tab"), false);
    });
  });

  var tabList = document.querySelector(".auth-tabs");
  if (tabList) {
    tabList.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
        return;
      }
      event.preventDefault();
      var mode = event.key === "ArrowRight" || event.key === "End" ? "register" : "login";
      setMode(mode, true);
    });
  }

  var initialMode = new URLSearchParams(global.location.search).get("mode");
  if (initialMode === "register" || global.location.hash === "#register") {
    setMode("register", false);
  } else {
    setMode("login", false);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-password]"), function (button) {
    button.addEventListener("click", function () {
      var input = document.getElementById(button.getAttribute("data-toggle-password"));
      if (!input) return;

      var showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
      button.setAttribute("aria-label", (showing ? "Show" : "Hide") + " password");
      button.setAttribute("aria-pressed", showing ? "false" : "true");
      input.focus();
    });
  });

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearAlert();

    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;
    var remember = document.getElementById("login-remember").checked;

    if (!email) {
      showAlert("Enter your email address.", "error");
      document.getElementById("login-email").focus();
      return;
    }
    if (!password) {
      showAlert("Enter your password.", "error");
      document.getElementById("login-password").focus();
      return;
    }

    setBusy(loginSubmit, true, "Logging in...");

    Promise.resolve()
      .then(function () {
        return BSL.loginUser(email, password, remember);
      })
      .then(function (user) {
        BSL.flash("Welcome back, " + user.firstName + "!", "success");
        global.location.href = nextPage;
      })
      .catch(function (error) {
        setBusy(loginSubmit, false);
        showAlert(error.message || "Login failed. Please try again.", "error");
        document.getElementById("login-password").select();
      });
  });

  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearAlert();

    var password = document.getElementById("register-password").value;
    var confirmPassword = document.getElementById("register-confirm").value;

    if (password !== confirmPassword) {
      showAlert("The two passwords do not match. Please re-enter them.", "error");
      document.getElementById("register-confirm").focus();
      return;
    }

    var values = {
      firstName: document.getElementById("register-first-name").value,
      lastName: document.getElementById("register-last-name").value,
      email: document.getElementById("register-email").value,
      phone: document.getElementById("register-phone").value,
      address: document.getElementById("register-address").value,
      password: password
    };

    setBusy(registerSubmit, true, "Creating account...");

    Promise.resolve()
      .then(function () {
        return BSL.registerUser(values);
      })
      .then(function () {
        return BSL.loginUser(values.email, password, true);
      })
      .then(function (user) {
        BSL.flash(
          "Account created. Welcome to your resident portal, " + user.firstName + "!",
          "success"
        );
        global.location.href = nextPage;
      })
      .catch(function (error) {
        setBusy(registerSubmit, false);
        showAlert(error.message || "Your account could not be created. Please try again.", "error");
      });
  });

  var passwordInput = document.getElementById("register-password");
  var confirmInput = document.getElementById("register-confirm");
  confirmInput.addEventListener("input", function () {
    confirmInput.classList.toggle(
      "input-mismatch",
      confirmInput.value.length > 0 && confirmInput.value !== passwordInput.value
    );
  });
  passwordInput.addEventListener("input", function () {
    if (!confirmInput.value) return;
    confirmInput.classList.toggle("input-mismatch", confirmInput.value !== passwordInput.value);
  });

  if (currentMode === "register") {
    document.title = "Create Account · Barangay Sta. Lucia";
  }
})(window);

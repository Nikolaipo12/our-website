/* Service request and concern forms: saves to the resident database. */
(function (global) {
  "use strict";

  var BSL = global.BSL;
  if (!BSL) return;

  var page = document.body.getAttribute("data-page");
  var form = document.getElementById(page === "services" ? "service-request-form" : "concern-request-form");
  if (!form) return;

  var alertEl = document.getElementById("form-alert");
  var user = BSL.getCurrentUser();
  var fieldIds =
    page === "services"
      ? ["service-full-name", "service-contact", "service-address", "service-type", "service-purpose"]
      : ["concern-name", "concern-contact", "concern-category", "concern-subject", "concern-message"];
  var nameField = document.getElementById(page === "services" ? "service-full-name" : "concern-name");
  var contactField = document.getElementById(page === "services" ? "service-contact" : "concern-contact");
  var addressField = document.getElementById("service-address");
  var nameNote = document.querySelector("[data-name-note]");
  var contactNote = document.querySelector("[data-contact-note]");
  var addressNote = document.querySelector("[data-address-note]");
  var accountGate = document.querySelector("[data-account-gate]");
  var formControls = form.querySelectorAll("input, select, textarea, button");

  function showAlert(message, type) {
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.className = "alert alert-" + (type || "info");
    alertEl.hidden = false;
  }

  function lockField(field, value, note, title) {
    if (!field) return;
    field.value = value == null ? "" : value;
    field.readOnly = true;
    field.setAttribute("aria-readonly", "true");
    field.classList.add("field-locked");
    field.title = title;
    if (note) note.hidden = false;
  }

  function lockAccountFields(account) {
    if (!account) return;
    lockField(
      nameField,
      account.fullName,
      nameNote,
      "This name is linked to your resident account."
    );
    lockField(
      contactField,
      account.phone,
      contactNote,
      "This number is linked to your resident account."
    );
    if (addressField) {
      lockField(
        addressField,
        account.address,
        addressNote,
        "This address is linked to your resident account."
      );
    }
  }

  function applyAccountGate(account) {
    var allowed = !!account;
    if (accountGate) accountGate.hidden = allowed;

    Array.prototype.forEach.call(formControls, function (control) {
      control.disabled = !allowed;
    });

    form.classList.toggle("form-disabled", !allowed);
    form.setAttribute("aria-disabled", allowed ? "false" : "true");
  }

  function restoreValues(values) {
    fieldIds.forEach(function (id) {
      var field = document.getElementById(id);
      if (field && values[id] != null) field.value = values[id];
    });
  }

  var draft = BSL.takeDraft(page);
  if (draft && user) {
    restoreValues(draft);
  }

  // Account details always win over any draft or edited value.
  lockAccountFields(user);
  applyAccountGate(user);

  var flash = BSL.consumeFlash();
  if (flash && flash.message) {
    showAlert(
      flash.message + (draft && user ? " Your draft has been restored — review it and submit when ready." : ""),
      flash.type || "info"
    );
  } else if (draft && user) {
    showAlert("Your draft has been restored. Review your details and submit when ready.", "info");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var currentUser = BSL.getCurrentUser();
    if (!currentUser) {
      applyAccountGate(null);
      return;
    }

    applyAccountGate(currentUser);
    lockAccountFields(currentUser);

    if (!form.checkValidity()) {
      var firstInvalid = form.querySelector(":invalid");
      if (firstInvalid) firstInvalid.focus();
      showAlert("Please complete all required fields before submitting.", "error");
      return;
    }

    try {
      if (page === "services") {
        var request = BSL.createRequest(currentUser.id, {
          type: document.getElementById("service-type").value,
          purpose: document.getElementById("service-purpose").value,
          contactNumber: currentUser.phone,
          address: currentUser.address
        });
        BSL.flash(
          "Your service request was submitted. Reference " + request.referenceNo + ". You can track it below.",
          "success"
        );
        global.location.href = "portal.html#requests";
      } else {
        var concern = BSL.createConcern(currentUser.id, {
          name: currentUser.fullName,
          contact: currentUser.phone,
          category: document.getElementById("concern-category").value,
          subject: document.getElementById("concern-subject").value,
          message: document.getElementById("concern-message").value
        });
        BSL.flash(
          "Your concern was submitted. Reference " + concern.referenceNo + ". You can track it below.",
          "success"
        );
        global.location.href = "portal.html#concerns";
      }
    } catch (error) {
      showAlert(error.message || "Your form could not be submitted. Please try again.", "error");
    }
  });
})(window);

/* Resident portal: account summary, service requests, and concerns. */
(function (global) {
  "use strict";

  var BSL = global.BSL;
  if (!BSL) return;

  var user = BSL.getCurrentUser();
  if (!user) {
    global.location.replace("login.html?next=portal.html");
    return;
  }

  var pageAlert = document.getElementById("page-alert");
  var requestsList = document.getElementById("requests-list");
  var concernsList = document.getElementById("concerns-list");

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function initialsOf(resident) {
    var first = (resident.firstName || "").charAt(0);
    var last = (resident.lastName || "").charAt(0);
    return (first + last).toUpperCase() || "RS";
  }

  function showPageAlert(message, type, scrollToAlert) {
    pageAlert.textContent = message;
    pageAlert.className = "alert alert-" + (type || "info");
    pageAlert.hidden = false;
    if (scrollToAlert) {
      pageAlert.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function clearPageAlert() {
    pageAlert.hidden = true;
    pageAlert.textContent = "";
  }

  function statusBadge(status) {
    return make("span", "status-badge " + BSL.statusClass(status), status);
  }

  function emptyState(title, copy) {
    var box = make("div", "panel-empty");
    box.appendChild(make("strong", null, title));
    box.appendChild(make("p", null, copy));
    return box;
  }

  function requestRecord(request) {
    var article = make("article", "record");

    var top = make("div", "record-top");
    var heading = make("div", "record-heading");
    heading.appendChild(make("h3", null, request.type));
    heading.appendChild(
      make(
        "div",
        "record-meta",
        request.referenceNo + " · Filed " + BSL.formatDate(request.createdAt)
      )
    );
    top.appendChild(heading);
    top.appendChild(statusBadge(request.status));
    article.appendChild(top);

    if (request.purpose) {
      article.appendChild(make("p", "record-text", request.purpose));
    }

    if (request.status === "Pending") {
      var footer = make("div", "record-footer");
      footer.appendChild(make("span", "record-note", "You can cancel this request while it is pending."));
      var cancel = make("button", "text-button", "Cancel request");
      cancel.type = "button";
      cancel.setAttribute("data-cancel-request", request.id);
      footer.appendChild(cancel);
      article.appendChild(footer);
    }

    return article;
  }

  function concernRecord(concern) {
    var article = make("article", "record");

    var top = make("div", "record-top");
    var heading = make("div", "record-heading");
    heading.appendChild(make("h3", null, concern.subject));
    heading.appendChild(
      make(
        "div",
        "record-meta",
        concern.referenceNo + " · " + concern.category + " · Filed " + BSL.formatDate(concern.createdAt)
      )
    );
    top.appendChild(heading);
    top.appendChild(statusBadge(concern.status));
    article.appendChild(top);

    article.appendChild(make("p", "record-text", concern.message));

    if (concern.response) {
      var response = make("div", "record-response");
      response.appendChild(make("strong", null, "Barangay response"));
      response.appendChild(make("p", null, concern.response));
      article.appendChild(response);
    }

    if (concern.status === "Open") {
      var footer = make("div", "record-footer");
      footer.appendChild(
        make("span", "record-note", "You can cancel this concern while it is still open.")
      );
      var cancel = make("button", "text-button", "Cancel concern");
      cancel.type = "button";
      cancel.setAttribute("data-cancel-concern", concern.id);
      footer.appendChild(cancel);
      article.appendChild(footer);
    }

    return article;
  }

  function render() {
    var requests = BSL.listRequests(user.id);
    var concerns = BSL.listConcerns(user.id);

    requestsList.textContent = "";
    if (requests.length === 0) {
      requestsList.appendChild(
        emptyState(
          "No service requests yet",
          "Requests you file through the Services page will appear here with their reference number and status."
        )
      );
    } else {
      var requestFragment = document.createDocumentFragment();
      requests.forEach(function (request) {
        requestFragment.appendChild(requestRecord(request));
      });
      requestsList.appendChild(requestFragment);
    }

    concernsList.textContent = "";
    if (concerns.length === 0) {
      concernsList.appendChild(
        emptyState(
          "No concerns submitted",
          "Concerns you send through the Concerns page will appear here with the barangay office's response."
        )
      );
    } else {
      var concernFragment = document.createDocumentFragment();
      concerns.forEach(function (concern) {
        concernFragment.appendChild(concernRecord(concern));
      });
      concernsList.appendChild(concernFragment);
    }

    var activeRequests = requests.filter(function (request) {
      return request.status === "Pending" || request.status === "Processing" || request.status === "Ready for Pickup";
    }).length;

    var activeConcerns = concerns.filter(function (concern) {
      return concern.status === "Open" || concern.status === "In Review";
    }).length;

    var completed =
      requests.filter(function (request) {
        return request.status === "Completed";
      }).length +
      concerns.filter(function (concern) {
        return concern.status === "Resolved";
      }).length;

    document.getElementById("stat-open-requests").textContent = String(activeRequests);
    document.getElementById("stat-open-concerns").textContent = String(activeConcerns);
    document.getElementById("stat-completed").textContent = String(completed);
    document.getElementById("stat-member-since").textContent = BSL.formatMonthYear(user.createdAt);
  }

  function prefillAccountDetails() {
    document.getElementById("user-name").textContent = user.fullName;
    document.getElementById("user-email").textContent = user.email;
    document.getElementById("user-initials").textContent = initialsOf(user);
    document.getElementById("portal-welcome").textContent =
      "Welcome back, " + user.firstName + ". Here is the latest on your requests and concerns.";

    document.getElementById("profile-fullname").textContent = user.fullName;
    document.getElementById("profile-email").textContent = user.email;
    document.getElementById("profile-phone").textContent = user.phone;
    document.getElementById("profile-address").textContent = user.address;
  }

  requestsList.addEventListener("click", function (event) {
    var button = event.target.closest("[data-cancel-request]");
    if (!button) return;

    var requestId = button.getAttribute("data-cancel-request");
    var request = BSL.listRequests(user.id).filter(function (item) {
      return item.id === requestId;
    })[0];
    if (!request) return;

    global
      .showConfirmDialog({
        tag: "Service request",
        title: "Cancel this service request?",
        message:
          "This permanently deletes the request from the database and removes it from your portal. This cannot be undone.",
        item: request.type + " · " + request.referenceNo,
        confirmLabel: "Cancel & remove",
        cancelLabel: "Keep request"
      })
      .then(function (confirmed) {
        if (!confirmed) return;

        try {
          BSL.cancelRequest(user.id, requestId);
          render();
          clearPageAlert();
          showPageAlert("The service request has been cancelled and removed.", "info", true);
        } catch (error) {
          showPageAlert(error.message || "The request could not be cancelled.", "error", true);
        }
      });
  });

  concernsList.addEventListener("click", function (event) {
    var button = event.target.closest("[data-cancel-concern]");
    if (!button) return;

    var concernId = button.getAttribute("data-cancel-concern");
    var concern = BSL.listConcerns(user.id).filter(function (item) {
      return item.id === concernId;
    })[0];
    if (!concern) return;

    global
      .showConfirmDialog({
        tag: "Concern",
        title: "Cancel this concern?",
        message:
          "This permanently deletes the concern from the database and removes it from your portal. This cannot be undone.",
        item: concern.subject + " · " + concern.referenceNo,
        confirmLabel: "Cancel & remove",
        cancelLabel: "Keep concern"
      })
      .then(function (confirmed) {
        if (!confirmed) return;

        try {
          BSL.cancelConcern(user.id, concernId);
          render();
          clearPageAlert();
          showPageAlert("The concern has been cancelled and removed.", "info", true);
        } catch (error) {
          showPageAlert(error.message || "The concern could not be cancelled.", "error", true);
        }
      });
  });

  function refreshAdminUi() {
    var current = BSL.getCurrentUser();
    if (!current) return;
    user = current;

    var adminLink = document.getElementById("admin-link");
    if (adminLink) adminLink.hidden = user.role !== "admin";
  }

  document.getElementById("logout-button").addEventListener("click", function () {
    BSL.logout();
    global.location.href = "index.html";
  });

  prefillAccountDetails();
  render();
  refreshAdminUi();

  var flash = BSL.consumeFlash();
  if (flash && flash.message) {
    showPageAlert(flash.message, flash.type || "info", false);
  }
})(window);

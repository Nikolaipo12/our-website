/* Administrator panel: manage all requests, concerns, and resident roles. */
(function (global) {
  "use strict";

  var BSL = global.BSL;
  if (!BSL) return;

  var user = BSL.getCurrentUser();
  if (!user) {
    global.location.replace("login.html?next=admin.html");
    return;
  }
  if (user.role !== "admin") {
    BSL.flash("Administrator access is required to open the admin panel.", "error");
    global.location.replace("portal.html");
    return;
  }

  var alertEl = document.getElementById("admin-alert");
  var announcementsList = document.getElementById("admin-announcements-list");
  var requestsList = document.getElementById("admin-requests-list");
  var concernsList = document.getElementById("admin-concerns-list");
  var residentsList = document.getElementById("admin-residents-list");
  var announcementDialog = document.getElementById("announcement-dialog");
  var announcementForm = document.getElementById("announcement-form");

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function showAlert(message, type, scrollToAlert) {
    alertEl.textContent = message;
    alertEl.className = "alert alert-" + (type || "info");
    alertEl.hidden = false;
    if (scrollToAlert) {
      alertEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function initialsOf(account) {
    var first = (account.firstName || "").charAt(0);
    var last = (account.lastName || "").charAt(0);
    return (first + last).toUpperCase() || "AD";
  }

  function statusBadge(status) {
    return make("span", "status-badge " + BSL.statusClass(status), status);
  }

  function recordMeta(parts) {
    return make("div", "record-meta", parts.filter(Boolean).join(" · "));
  }

  function emptyState(title, copy) {
    var box = make("div", "panel-empty");
    box.appendChild(make("strong", null, title));
    box.appendChild(make("p", null, copy));
    return box;
  }

  function showDialogAlert(form, message) {
    var alert = form.querySelector("[data-dialog-alert]");
    if (!alert) return;
    alert.textContent = message;
    alert.className = "alert alert-error";
    alert.hidden = false;
  }

  function clearDialogAlert(form) {
    var alert = form.querySelector("[data-dialog-alert]");
    if (!alert) return;
    alert.hidden = true;
    alert.textContent = "";
  }

  function todayValue() {
    var today = new Date();
    return (
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0")
    );
  }

  function statusField(current, options, attribute, id) {
    var label = make("label", "admin-status-field");
    label.appendChild(make("span", "admin-field-label", "Status"));

    var select = document.createElement("select");
    select.className = "admin-status-select";
    select.setAttribute(attribute, id);

    options.forEach(function (status) {
      var option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      select.appendChild(option);
    });

    select.value = current;
    label.appendChild(select);
    return label;
  }

  function announcementRecord(announcement) {
    var article = make("article", "record admin-record announcement-record");

    var top = make("div", "record-top");
    var heading = make("div", "record-heading");
    heading.appendChild(make("h3", null, announcement.title));
    heading.appendChild(
      recordMeta([
        announcement.category,
        "Posted " + BSL.formatDate(announcement.publishedAt),
        "By " + (announcement.authorName || "Barangay Office")
      ])
    );
    top.appendChild(heading);

    var actions = make("div", "admin-record-actions");
    var edit = make("button", "small-button", "Edit");
    edit.type = "button";
    edit.setAttribute("data-edit-announcement", announcement.id);
    actions.appendChild(edit);

    var remove = make("button", "small-button danger-outline", "Delete");
    remove.type = "button";
    remove.setAttribute("data-delete-announcement", announcement.id);
    actions.appendChild(remove);

    top.appendChild(actions);
    article.appendChild(top);
    article.appendChild(make("p", "record-text", announcement.body));

    return article;
  }

  function requestRecord(request) {
    var article = make("article", "record admin-record");

    var top = make("div", "record-top");
    var heading = make("div", "record-heading");
    heading.appendChild(make("h3", null, request.type));
    heading.appendChild(
      recordMeta([
        request.referenceNo,
        request.residentName,
        "Filed " + BSL.formatDate(request.createdAt)
      ])
    );
    top.appendChild(heading);
    top.appendChild(statusBadge(request.status));
    article.appendChild(top);

    article.appendChild(make("p", "record-text", request.purpose));

    var details = make("div", "admin-detail-grid");
    var contact = make("div", "admin-detail");
    contact.appendChild(make("span", "admin-field-label", "Contact"));
    contact.appendChild(make("span", null, request.contactNumber));
    details.appendChild(contact);

    var address = make("div", "admin-detail");
    address.appendChild(make("span", "admin-field-label", "Address"));
    address.appendChild(make("span", null, request.address));
    details.appendChild(address);

    var email = make("div", "admin-detail");
    email.appendChild(make("span", "admin-field-label", "Email"));
    email.appendChild(make("span", null, request.residentEmail || "—"));
    details.appendChild(email);
    article.appendChild(details);

    var controls = make("div", "admin-controls");
    controls.appendChild(
      statusField(request.status, BSL.REQUEST_STATUSES, "data-request-status", request.id)
    );
    controls.appendChild(
      make(
        "span",
        "record-note",
        "Saving a new status updates the resident's portal immediately."
      )
    );
    var remove = make("button", "small-button danger-outline", "Delete request");
    remove.type = "button";
    remove.setAttribute("data-delete-admin-request", request.id);
    controls.appendChild(remove);
    article.appendChild(controls);

    return article;
  }

  function concernRecord(concern) {
    var article = make("article", "record admin-record");

    var top = make("div", "record-top");
    var heading = make("div", "record-heading");
    heading.appendChild(make("h3", null, concern.subject));
    heading.appendChild(
      recordMeta([
        concern.referenceNo,
        concern.category,
        concern.residentName,
        "Filed " + BSL.formatDate(concern.createdAt)
      ])
    );
    top.appendChild(heading);
    top.appendChild(statusBadge(concern.status));
    article.appendChild(top);

    article.appendChild(make("p", "record-text", concern.message));

    var details = make("div", "admin-detail-grid");
    var contact = make("div", "admin-detail");
    contact.appendChild(make("span", "admin-field-label", "Contact given"));
    contact.appendChild(make("span", null, concern.contact));
    details.appendChild(contact);

    var email = make("div", "admin-detail");
    email.appendChild(make("span", "admin-field-label", "Account email"));
    email.appendChild(make("span", null, concern.residentEmail || "—"));
    details.appendChild(email);
    article.appendChild(details);

    var responseLabel = make("label", "admin-response-field");
    responseLabel.appendChild(make("span", "admin-field-label", "Response to resident (optional)"));
    var response = document.createElement("textarea");
    response.className = "admin-response";
    response.maxLength = 2000;
    response.placeholder = "Write an update the resident will see in their portal.";
    response.value = concern.response || "";
    response.setAttribute("data-concern-response", concern.id);
    responseLabel.appendChild(response);
    article.appendChild(responseLabel);

    var controls = make("div", "admin-controls");
    controls.appendChild(
      statusField(concern.status, BSL.CONCERN_STATUSES, "data-concern-status", concern.id)
    );

    var save = make("button", "form-button form-button-small", "Save concern update");
    save.type = "button";
    save.setAttribute("data-save-concern", concern.id);
    controls.appendChild(save);

    var remove = make("button", "small-button danger-outline", "Delete concern");
    remove.type = "button";
    remove.setAttribute("data-delete-admin-concern", concern.id);
    controls.appendChild(remove);
    article.appendChild(controls);

    return article;
  }

  function residentRecord(resident) {
    var article = make("article", "record admin-record resident-record");

    var top = make("div", "record-top");
    var heading = make("div", "record-heading");
    var nameLine = make("h3");
    nameLine.appendChild(document.createTextNode(resident.fullName + " "));
    var roleBadge = make(
      "span",
      "role-badge " + (resident.role === "admin" ? "role-admin" : "role-resident"),
      resident.role === "admin" ? "Administrator" : "Resident"
    );
    nameLine.appendChild(roleBadge);
    heading.appendChild(nameLine);

    heading.appendChild(
      recordMeta([resident.email, resident.phone, "Joined " + BSL.formatDate(resident.createdAt)])
    );
    heading.appendChild(make("div", "record-meta", resident.address));
    top.appendChild(heading);

    if (resident.id === user.id) {
      top.appendChild(make("span", "pill", "You"));
    } else {
      var action = make(
        "button",
        "small-button " + (resident.role === "admin" ? "danger-outline" : ""),
        resident.role === "admin" ? "Remove admin" : "Make admin"
      );
      action.type = "button";
      action.setAttribute("data-set-role", resident.id);
      action.setAttribute("data-next-role", resident.role === "admin" ? "resident" : "admin");
      top.appendChild(action);
    }

    article.appendChild(top);
    return article;
  }

  function render() {
    var announcements = BSL.listAnnouncements();
    var requests = BSL.listAllRequests(user.id);
    var concerns = BSL.listAllConcerns(user.id);
    var residents = BSL.listResidents(user.id);

    // Announcements
    announcementsList.textContent = "";
    if (announcements.length === 0) {
      announcementsList.appendChild(
        emptyState(
          "No announcements yet",
          "Publish your first announcement to share news on the public website."
        )
      );
    } else {
      var announcementFragment = document.createDocumentFragment();
      announcements.forEach(function (announcement) {
        announcementFragment.appendChild(announcementRecord(announcement));
      });
      announcementsList.appendChild(announcementFragment);
    }

    // Requests
    requestsList.textContent = "";
    if (requests.length === 0) {
      requestsList.appendChild(
        emptyState("No service requests yet", "Requests filed by residents will appear here.")
      );
    } else {
      var requestFragment = document.createDocumentFragment();
      requests.forEach(function (request) {
        requestFragment.appendChild(requestRecord(request));
      });
      requestsList.appendChild(requestFragment);
    }

    // Concerns
    concernsList.textContent = "";
    if (concerns.length === 0) {
      concernsList.appendChild(
        emptyState("No concerns yet", "Complaints, suggestions, and community reports will appear here.")
      );
    } else {
      var concernFragment = document.createDocumentFragment();
      concerns.forEach(function (concern) {
        concernFragment.appendChild(concernRecord(concern));
      });
      concernsList.appendChild(concernFragment);
    }

    // Residents & admins
    residentsList.textContent = "";
    var residentFragment = document.createDocumentFragment();
    residents.forEach(function (resident) {
      residentFragment.appendChild(residentRecord(resident));
    });
    residentsList.appendChild(residentFragment);

    var attention =
      requests.filter(function (request) {
        return request.status === "Pending";
      }).length +
      concerns.filter(function (concern) {
        return concern.status === "Open";
      }).length;

    document.getElementById("admin-stat-residents").textContent = String(residents.length);
    document.getElementById("admin-stat-requests").textContent = String(requests.length);
    document.getElementById("admin-stat-concerns").textContent = String(concerns.length);
    document.getElementById("admin-stat-attention").textContent = String(attention);
    document.getElementById("admin-announcements-count").textContent = String(announcements.length);
    document.getElementById("admin-requests-count").textContent = String(requests.length);
    document.getElementById("admin-concerns-count").textContent = String(concerns.length);
    document.getElementById("admin-residents-count").textContent = String(residents.length);
  }

  document.getElementById("admin-name").textContent = user.fullName;
  document.getElementById("admin-email").textContent = user.email;
  document.getElementById("admin-initials").textContent = initialsOf(user);

  function openAnnouncementDialog(announcementId) {
    announcementForm.reset();
    clearDialogAlert(announcementForm);

    var idField = document.getElementById("announcement-id");
    idField.value = "";
    document.getElementById("announcement-date").value = todayValue();
    document.getElementById("announcement-dialog-title").textContent = "New announcement";
    document.getElementById("announcement-submit").textContent = "Publish announcement";

    if (announcementId) {
      var announcement = BSL.listAnnouncements().filter(function (item) {
        return item.id === announcementId;
      })[0];

      if (!announcement) {
        showAlert("That announcement could not be found.", "error", true);
        return;
      }

      idField.value = announcement.id;
      document.getElementById("announcement-title").value = announcement.title;
      document.getElementById("announcement-category").value = announcement.category;
      document.getElementById("announcement-date").value = announcement.publishedAt;
      document.getElementById("announcement-body").value = announcement.body;
      document.getElementById("announcement-dialog-title").textContent = "Edit announcement";
      document.getElementById("announcement-submit").textContent = "Save changes";
    }

    if (typeof announcementDialog.showModal === "function") {
      announcementDialog.showModal();
    } else {
      announcementDialog.setAttribute("open", "");
    }
    document.getElementById("announcement-title").focus();
  }

  document.addEventListener("click", function (event) {
    var opener = event.target.closest("[data-open-announcement-dialog]");
    if (opener) {
      openAnnouncementDialog();
      return;
    }

    var editButton = event.target.closest("[data-edit-announcement]");
    if (editButton) {
      openAnnouncementDialog(editButton.getAttribute("data-edit-announcement"));
      return;
    }

    var deleteButton = event.target.closest("[data-delete-announcement]");
    if (deleteButton) {
      var announcementId = deleteButton.getAttribute("data-delete-announcement");
      var announcement = BSL.listAnnouncements().filter(function (item) {
        return item.id === announcementId;
      })[0];
      if (!announcement) return;

      global
        .showConfirmDialog({
          tag: "Announcement",
          title: "Delete this announcement?",
          message:
            "This removes it from the public home page and announcements page. This cannot be undone.",
          item: announcement.title,
          confirmLabel: "Delete announcement",
          cancelLabel: "Keep announcement"
        })
        .then(function (confirmed) {
          if (!confirmed) return;

          try {
            BSL.deleteAnnouncement(user.id, announcementId);
            render();
            showAlert("Announcement deleted from the public website.", "info", true);
          } catch (error) {
            showAlert(error.message || "The announcement could not be deleted.", "error", true);
          }
        });
      return;
    }

    var closer = event.target.closest("[data-close-dialog]");
    if (closer) {
      var dialog = closer.closest("dialog");
      if (dialog && typeof dialog.close === "function") dialog.close();
    }
  });

  if (announcementDialog) {
    announcementDialog.addEventListener("click", function (event) {
      if (event.target === announcementDialog) announcementDialog.close();
    });
  }

  announcementForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearDialogAlert(announcementForm);

    var announcementId = document.getElementById("announcement-id").value;
    var announcementInput = {
      title: document.getElementById("announcement-title").value,
      category: document.getElementById("announcement-category").value,
      publishedAt: document.getElementById("announcement-date").value,
      body: document.getElementById("announcement-body").value
    };

    try {
      if (announcementId) {
        BSL.updateAnnouncement(user.id, announcementId, announcementInput);
      } else {
        BSL.createAnnouncement(user.id, announcementInput);
      }

      announcementDialog.close();
      render();
      showAlert(
        announcementId
          ? "Announcement updated. The public announcements page now shows the new version."
          : "Announcement published. It is now visible on the public announcements page and home page.",
        "success",
        true
      );
    } catch (error) {
      showDialogAlert(
        announcementForm,
        error.message || "The announcement could not be saved."
      );
    }
  });

  requestsList.addEventListener("change", function (event) {
    var select = event.target.closest("[data-request-status]");
    if (!select) return;

    var nextStatus = select.value;

    try {
      BSL.updateRequestStatus(
        user.id,
        select.getAttribute("data-request-status"),
        nextStatus
      );
      render();
      showAlert(
        "Service request status changed to “" + nextStatus + "”. The resident's portal has been updated.",
        "success",
        true
      );
    } catch (error) {
      render();
      showAlert(error.message || "The request status could not be updated.", "error", true);
    }
  });

  requestsList.addEventListener("click", function (event) {
    var button = event.target.closest("[data-delete-admin-request]");
    if (!button) return;

    var requestId = button.getAttribute("data-delete-admin-request");
    var request = BSL.listAllRequests(user.id).filter(function (item) {
      return item.id === requestId;
    })[0];
    if (!request) return;

    global
      .showConfirmDialog({
        tag: "Service request",
        title: "Delete this service request?",
        message:
          "This permanently deletes the request from the database and removes it from the resident's portal. This cannot be undone.",
        item: request.type + " · " + request.referenceNo + " · " + request.residentName,
        confirmLabel: "Delete request",
        cancelLabel: "Keep request"
      })
      .then(function (confirmed) {
        if (!confirmed) return;

        try {
          BSL.deleteRequestAsAdmin(user.id, requestId);
          render();
          showAlert("Service request permanently deleted.", "success", true);
        } catch (error) {
          showAlert(error.message || "The service request could not be deleted.", "error", true);
        }
      });
  });

  concernsList.addEventListener("click", function (event) {
    var deleteButton = event.target.closest("[data-delete-admin-concern]");
    if (deleteButton) {
      var concernId = deleteButton.getAttribute("data-delete-admin-concern");
      var concern = BSL.listAllConcerns(user.id).filter(function (item) {
        return item.id === concernId;
      })[0];
      if (!concern) return;

      global
        .showConfirmDialog({
          tag: "Concern",
          title: "Delete this concern?",
          message:
            "This permanently deletes the concern from the database and removes it from the resident's portal. This cannot be undone.",
          item: concern.subject + " · " + concern.referenceNo + " · " + concern.residentName,
          confirmLabel: "Delete concern",
          cancelLabel: "Keep concern"
        })
        .then(function (confirmed) {
          if (!confirmed) return;

          try {
            BSL.deleteConcernAsAdmin(user.id, concernId);
            render();
            showAlert("Concern permanently deleted.", "success", true);
          } catch (error) {
            showAlert(error.message || "The concern could not be deleted.", "error", true);
          }
        });
      return;
    }

    var button = event.target.closest("[data-save-concern]");
    if (!button) return;

    var concernId = button.getAttribute("data-save-concern");
    var container = button.closest(".admin-record");
    var statusSelect = container.querySelector("[data-concern-status]");
    var responseField = container.querySelector("[data-concern-response]");

    try {
      BSL.updateConcernStatus(
        user.id,
        concernId,
        statusSelect.value,
        responseField.value
      );
      render();
      showAlert(
        "Concern updated. The resident can now see the new status and response in their portal.",
        "success",
        true
      );
    } catch (error) {
      showAlert(error.message || "The concern could not be updated.", "error", true);
    }
  });

  residentsList.addEventListener("click", function (event) {
    var button = event.target.closest("[data-set-role]");
    if (!button) return;

    var targetId = button.getAttribute("data-set-role");
    var nextRole = button.getAttribute("data-next-role");
    var residentName = button
      .closest(".admin-record")
      .querySelector("h3")
      .textContent.replace(/\s*(Administrator|Resident)\s*$/, "")
      .trim();

    var isPromotion = nextRole === "admin";

    global
      .showConfirmDialog({
        tag: isPromotion ? "Administrator access" : "Resident account",
        title: isPromotion ? "Give administrator access?" : "Remove administrator access?",
        message: isPromotion
          ? "This lets " +
            residentName +
            " manage all residents, requests, concerns, and announcements."
          : "This removes " +
            residentName +
            "'s access to the admin panel and administrator tools.",
        item: residentName,
        confirmLabel: isPromotion ? "Make admin" : "Remove admin",
        cancelLabel: "Keep current role"
      })
      .then(function (confirmed) {
        if (!confirmed) return;

        try {
          BSL.setUserRole(user.id, targetId, nextRole);
          render();
          showAlert(
            isPromotion
              ? residentName + " is now an administrator."
              : residentName + " is now a resident account.",
            "success",
            true
          );
        } catch (error) {
          showAlert(error.message || "The account role could not be changed.", "error", true);
        }
      });
  });

  document.getElementById("admin-logout").addEventListener("click", function () {
    BSL.logout();
    global.location.href = "index.html";
  });

  render();

  var flash = BSL.consumeFlash();
  if (flash && flash.message) {
    showAlert(flash.message, flash.type || "info", false);
  }
})(window);

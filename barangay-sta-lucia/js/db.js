/* ============================================================
   Barangay Sta. Lucia — Resident database & authentication
   ------------------------------------------------------------
   This file is the single data layer for the site. It stores
   three related "tables" in localStorage:

     users    -> resident accounts (PBKDF2-hashed passwords)
     requests -> service requests filed by residents
     concerns -> concerns filed by residents

   Passwords are never stored in plain text. This is a
   front-end-only database intended for a self-contained demo;
   see README-PORTAL.md before using it for real resident data.
   ============================================================ */
(function (global) {
  "use strict";

  var DB_KEY = "bsl.db.v1";
  var SESSION_KEY = "bsl.session.v1";
  var FLASH_KEY = "bsl.flash.v1";
  var DRAFT_PREFIX = "bsl.draft.v1.";
  var PBKDF2_ITERATIONS = 150000;
  var SESSION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  var SESSION_SHORT_MS = 12 * 60 * 60 * 1000; // 12 hours
  var DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

  var REQUEST_STATUSES = ["Pending", "Processing", "Ready for Pickup", "Completed"];
  var CONCERN_STATUSES = ["Open", "In Review", "Resolved", "Closed"];
  var ANNOUNCEMENT_CATEGORIES = ["General", "Events", "Services", "Emergency", "Community"];

  // The default barangay administrator for this demo build. The password is
  // documented in README-PORTAL.md and is never stored in plain text here.
  var DEFAULT_ADMIN_SEED = "nikkolai-v1";
  var DEFAULT_ADMIN = {
    email: "nikkolai@gmail.com",
    firstName: "Nikkolai",
    lastName: "Pabalate",
    phone: "09935503423",
    address: "Barangay Sta. Lucia, Santa Ana, Pampanga",
    passwordHash: "1116ac4f24570daca2a435acb0714c288e6dd825327e250c8600cfe5d1682a0a",
    passwordSalt: "afac270b374893936898f9aa8ec770f7",
    passwordIterations: 150000
  };

  var storageOk = null;

  function storageAvailable() {
    if (storageOk !== null) return storageOk;
    try {
      var probe = "__bsl_probe__";
      global.localStorage.setItem(probe, "1");
      global.localStorage.removeItem(probe);
      storageOk = true;
    } catch (error) {
      storageOk = false;
    }
    return storageOk;
  }

  function ensureStorage() {
    if (!storageAvailable()) {
      throw new Error(
        "This browser has blocked local storage. Allow site data for this page, then reload. If you opened the file directly, try serving it over HTTP (for example with XAMPP)."
      );
    }
  }

  function readJson(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    ensureStorage();
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new Error("The resident database could not save your data. Browser storage may be full.");
    }
  }

  function emptyDatabase() {
    return {
      version: 1,
      adminSeed: "",
      users: [],
      requests: [],
      concerns: [],
      announcements: [],
      counters: { user: 0, request: 0, concern: 0, announcement: 0 }
    };
  }

  function seedAnnouncements() {
    var seeds = [
      {
        id: "ann_seed_1",
        title: "Heavy Rain Advisory",
        category: "Emergency",
        publishedAt: "2026-08-10",
        body: "Residents are advised to secure important documents and stay updated on emergency announcements due to expected heavy rains.",
        authorName: "Barangay Office",
        createdAt: "2026-08-10T08:00:00.000Z",
        updatedAt: "2026-08-10T08:00:00.000Z"
      },
      {
        id: "ann_seed_2",
        title: "Community Clean-Up Day",
        category: "Events",
        publishedAt: "2026-08-05",
        body: "Join barangay volunteers on Saturday for a community clean-up and tree planting activity starting at 8:00 AM.",
        authorName: "Barangay Office",
        createdAt: "2026-08-05T08:00:00.000Z",
        updatedAt: "2026-08-05T08:00:00.000Z"
      },
      {
        id: "ann_seed_3",
        title: "Certificate Request Schedule",
        category: "Services",
        publishedAt: "2026-08-02",
        body: "Available services include certificate of residency, indigency, and barangay clearance. Requests are processed within 1–2 working days.",
        authorName: "Barangay Office",
        createdAt: "2026-08-02T08:00:00.000Z",
        updatedAt: "2026-08-02T08:00:00.000Z"
      },
      {
        id: "ann_seed_4",
        title: "Barangay Office Hours Update",
        category: "General",
        publishedAt: "2026-07-28",
        body: "The office is open Monday to Friday from 8:00 AM to 5:00 PM. Please visit for valid IDs and barangay certifications.",
        authorName: "Barangay Office",
        createdAt: "2026-07-28T08:00:00.000Z",
        updatedAt: "2026-07-28T08:00:00.000Z"
      },
      {
        id: "ann_seed_5",
        title: "Barangay Health Fair",
        category: "Community",
        publishedAt: "2026-07-18",
        body: "Health services, immunizations, and consultations will be available for residents at the barangay hall on August 22.",
        authorName: "Barangay Office",
        createdAt: "2026-07-18T08:00:00.000Z",
        updatedAt: "2026-07-18T08:00:00.000Z"
      }
    ];
    return seeds;
  }

  function ensureDefaultAdmin(database) {
    if (!database || !Array.isArray(database.users)) return false;
    if (database.adminSeed === DEFAULT_ADMIN_SEED) return false;

    var admin = null;
    for (var i = 0; i < database.users.length; i += 1) {
      if (normaliseEmail(database.users[i].email) === DEFAULT_ADMIN.email) {
        admin = database.users[i];
        break;
      }
    }

    if (!admin) {
      database.counters.user =
        Math.max(Number(database.counters.user) || 0, database.users.length) + 1;
      admin = {
        id: "usr_default_admin",
        firstName: DEFAULT_ADMIN.firstName,
        lastName: DEFAULT_ADMIN.lastName,
        email: DEFAULT_ADMIN.email,
        phone: DEFAULT_ADMIN.phone,
        address: DEFAULT_ADMIN.address,
        passwordHash: DEFAULT_ADMIN.passwordHash,
        passwordSalt: DEFAULT_ADMIN.passwordSalt,
        passwordIterations: DEFAULT_ADMIN.passwordIterations,
        role: "admin",
        createdAt: nowIso()
      };
      database.users.push(admin);
    } else {
      admin.firstName = DEFAULT_ADMIN.firstName;
      admin.lastName = DEFAULT_ADMIN.lastName;
      admin.email = DEFAULT_ADMIN.email;
      admin.phone = DEFAULT_ADMIN.phone;
      admin.address = DEFAULT_ADMIN.address;
      admin.passwordHash = DEFAULT_ADMIN.passwordHash;
      admin.passwordSalt = DEFAULT_ADMIN.passwordSalt;
      admin.passwordIterations = DEFAULT_ADMIN.passwordIterations;
      admin.role = "admin";
      if (!admin.createdAt) admin.createdAt = nowIso();
    }

    database.adminSeed = DEFAULT_ADMIN_SEED;
    return true;
  }

  function getDatabase() {
    var stored = readJson(DB_KEY, null);
    var database;

    if (!stored || typeof stored !== "object") {
      database = emptyDatabase();
      database.announcements = seedAnnouncements();
      database.counters.announcement = database.announcements.length;
    } else {
      database = emptyDatabase();
      database.users = Array.isArray(stored.users) ? stored.users : [];
      database.requests = Array.isArray(stored.requests) ? stored.requests : [];
      database.concerns = Array.isArray(stored.concerns) ? stored.concerns : [];

      // Older databases do not have an announcements table yet. Seed it in
      // memory; it is written on the next save. An intentionally empty
      // announcements array is respected (deleting all does not re-seed).
      var announcementsMissing = !Array.isArray(stored.announcements);
      database.announcements = announcementsMissing
        ? seedAnnouncements()
        : stored.announcements;

      var counters = stored.counters && typeof stored.counters === "object" ? stored.counters : {};
      database.counters.user = Math.max(Number(counters.user) || 0, database.users.length);
      database.counters.request = Math.max(Number(counters.request) || 0, database.requests.length);
      database.counters.concern = Math.max(Number(counters.concern) || 0, database.concerns.length);
      database.counters.announcement = Math.max(
        Number(counters.announcement) || 0,
        database.announcements.length
      );
    }

    // Existing browser databases are migrated once so the default
    // administrator is available without a first-resident setup step.
    var seededAdmin = ensureDefaultAdmin(database);
    if (seededAdmin && storageAvailable()) {
      try {
        saveDatabase(database);
      } catch (error) {
        // The seeded account still works for this page view; the next
        // successful write will persist it.
      }
    }

    return database;
  }

  function saveDatabase(database) {
    writeJson(DB_KEY, database);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function randomHex(byteCount) {
    var bytes = new Uint8Array(byteCount || 16);
    if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.prototype.map
      .call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < bytes.length; i += 1) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  function bytesToHex(bytes) {
    return Array.prototype.map
      .call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function hashPassword(password, saltHex, iterations) {
    var subtle = global.crypto && global.crypto.subtle;
    if (!subtle) {
      return Promise.reject(
        new Error(
          "Secure password hashing is not available in this browser. Open the site in an updated version of Chrome, Edge, Firefox, or Safari."
        )
      );
    }

    var rounds = Number(iterations) || PBKDF2_ITERATIONS;
    var encoder = new TextEncoder();

    return subtle
      .importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"])
      .then(function (keyMaterial) {
        return subtle.deriveBits(
          {
            name: "PBKDF2",
            salt: hexToBytes(saltHex),
            iterations: rounds,
            hash: "SHA-256"
          },
          keyMaterial,
          256
        );
      })
      .then(function (bits) {
        return bytesToHex(new Uint8Array(bits));
      });
  }

  function normaliseEmail(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function cleanLine(value, maxLength, label) {
    var text = String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();

    if (!text) throw new Error(label + " is required.");
    if (text.length > maxLength) {
      throw new Error(label + " must be " + maxLength + " characters or fewer.");
    }
    return text;
  }

  function cleanMessage(value, maxLength, label) {
    var text = String(value == null ? "" : value).trim();

    if (!text) throw new Error(label + " is required.");
    if (text.length > maxLength) {
      throw new Error(label + " must be " + maxLength + " characters or fewer.");
    }
    return text;
  }

  function validatePassword(password) {
    var value = String(password || "");
    if (value.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
      throw new Error("Password must include at least one letter and one number.");
    }
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.firstName + " " + user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role === "admin" ? "admin" : "resident",
      createdAt: user.createdAt
    };
  }

  function findUser(database, userId) {
    for (var i = 0; i < database.users.length; i += 1) {
      if (database.users[i].id === userId) return database.users[i];
    }
    return null;
  }

  function registerUser(input) {
    ensureStorage();

    var firstName = cleanLine(input.firstName, 60, "First name");
    var lastName = cleanLine(input.lastName, 60, "Last name");
    var email = normaliseEmail(input.email);
    var phone = cleanLine(input.phone, 40, "Mobile number");
    var address = cleanLine(input.address, 200, "Address");
    var password = String(input.password || "");

    if (!isEmail(email)) {
      throw new Error("Enter a valid email address, for example maria@example.com.");
    }
    if (phone.replace(/\D/g, "").length < 7) {
      throw new Error("Enter a valid mobile or contact number.");
    }
    validatePassword(password);

    var database = getDatabase();
    for (var i = 0; i < database.users.length; i += 1) {
      if (database.users[i].email === email) {
        throw new Error("An account with this email already exists. Try logging in instead.");
      }
    }

    var salt = randomHex(16);
    var iterations = PBKDF2_ITERATIONS;

    return hashPassword(password, salt, iterations).then(function (passwordHash) {
      // Reload in case another tab changed the database while hashing.
      database = getDatabase();
      for (var j = 0; j < database.users.length; j += 1) {
        if (database.users[j].email === email) {
          throw new Error("An account with this email already exists. Try logging in instead.");
        }
      }

      database.counters.user += 1;
      var user = {
        id: "usr_" + database.counters.user + "_" + randomHex(4),
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        address: address,
        passwordHash: passwordHash,
        passwordSalt: salt,
        passwordIterations: iterations,
        role: "resident",
        createdAt: nowIso()
      };

      database.users.push(user);
      saveDatabase(database);
      return publicUser(user);
    });
  }

  function createSession(user, remember) {
    var duration = remember ? SESSION_REMEMBER_MS : SESSION_SHORT_MS;
    var session = {
      userId: user.id,
      token: randomHex(16),
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + duration).toISOString()
    };
    writeJson(SESSION_KEY, session);
  }

  function loginUser(emailInput, password, remember) {
    ensureStorage();

    var email = normaliseEmail(emailInput);
    if (!isEmail(email)) {
      return Promise.reject(new Error("Enter a valid email address."));
    }
    if (!password) {
      return Promise.reject(new Error("Enter your password."));
    }

    var database = getDatabase();
    var user = null;
    for (var i = 0; i < database.users.length; i += 1) {
      if (database.users[i].email === email) {
        user = database.users[i];
        break;
      }
    }

    if (!user) {
      return Promise.reject(new Error("No account was found for that email address. Check the spelling or create an account."));
    }

    return hashPassword(password, user.passwordSalt, user.passwordIterations).then(function (passwordHash) {
      if (passwordHash !== user.passwordHash) {
        throw new Error("Incorrect password. Please try again.");
      }
      createSession(user, remember);
      return publicUser(user);
    });
  }

  function getCurrentUser() {
    if (!storageAvailable()) return null;

    var session = readJson(SESSION_KEY, null);
    if (!session || !session.userId || !session.expiresAt) return null;

    if (Date.parse(session.expiresAt) <= Date.now()) {
      try {
        global.localStorage.removeItem(SESSION_KEY);
      } catch (error) {
        /* ignore */
      }
      return null;
    }

    var database = getDatabase();
    return publicUser(findUser(database, session.userId));
  }

  function logout() {
    try {
      global.localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  function createRequest(userId, input) {
    ensureStorage();

    var database = getDatabase();
    var user = findUser(database, userId);
    if (!user) throw new Error("Please log in again before submitting a request.");

    var type = cleanLine(input.type, 80, "Type of request");
    var purpose = cleanMessage(input.purpose, 1000, "Purpose");
    var contactNumber = cleanLine(input.contactNumber || user.phone, 40, "Contact number");
    var address = cleanLine(input.address || user.address, 200, "Address");

    database.counters.request += 1;
    var year = String(new Date().getFullYear()).slice(-2);
    var referenceNo = "REQ-" + year + "-" + String(database.counters.request).padStart(4, "0");

    var request = {
      id: "req_" + database.counters.request + "_" + randomHex(4),
      referenceNo: referenceNo,
      userId: user.id,
      type: type,
      purpose: purpose,
      contactNumber: contactNumber,
      address: address,
      status: "Pending",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    database.requests.push(request);
    saveDatabase(database);
    return request;
  }

  function createConcern(userId, input) {
    ensureStorage();

    var database = getDatabase();
    var user = findUser(database, userId);
    if (!user) throw new Error("Please log in again before submitting a concern.");

    var name = cleanLine(input.name || user.firstName + " " + user.lastName, 120, "Name");
    var contact = cleanLine(input.contact || user.phone, 80, "Contact information");
    var category = cleanLine(input.category, 60, "Type of concern");
    var subject = cleanLine(input.subject, 120, "Subject");
    var message = cleanMessage(input.message, 2000, "Message");

    database.counters.concern += 1;
    var year = String(new Date().getFullYear()).slice(-2);
    var referenceNo = "CON-" + year + "-" + String(database.counters.concern).padStart(4, "0");

    var concern = {
      id: "con_" + database.counters.concern + "_" + randomHex(4),
      referenceNo: referenceNo,
      userId: user.id,
      name: name,
      contact: contact,
      category: category,
      subject: subject,
      message: message,
      status: "Open",
      response: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    database.concerns.push(concern);
    saveDatabase(database);
    return concern;
  }

  function listRequests(userId) {
    return getDatabase()
      .requests.filter(function (request) {
        return request.userId === userId;
      })
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  function listConcerns(userId) {
    return getDatabase()
      .concerns.filter(function (concern) {
        return concern.userId === userId;
      })
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  function cancelRequest(userId, requestId) {
    ensureStorage();

    var database = getDatabase();
    var index = -1;
    for (var i = 0; i < database.requests.length; i += 1) {
      if (database.requests[i].id === requestId && database.requests[i].userId === userId) {
        index = i;
        break;
      }
    }

    if (index === -1) throw new Error("That request could not be found.");
    if (database.requests[index].status !== "Pending") {
      throw new Error("Only requests that are still pending can be cancelled. Please contact the barangay hall.");
    }

    var removed = database.requests.splice(index, 1)[0];
    saveDatabase(database);
    return removed;
  }

  function cancelConcern(userId, concernId) {
    ensureStorage();

    var database = getDatabase();
    var index = -1;
    for (var i = 0; i < database.concerns.length; i += 1) {
      if (database.concerns[i].id === concernId && database.concerns[i].userId === userId) {
        index = i;
        break;
      }
    }

    if (index === -1) throw new Error("That concern could not be found.");
    if (database.concerns[index].status !== "Open") {
      throw new Error(
        "Only concerns that are still open can be cancelled. Please contact the barangay hall."
      );
    }

    var removed = database.concerns.splice(index, 1)[0];
    saveDatabase(database);
    return removed;
  }

  /* ---------- Administrator accounts & moderation ---------- */

  function hasAdmin() {
    return getDatabase().users.some(function (user) {
      return user.role === "admin";
    });
  }

  function requireAdmin(database, adminUserId) {
    var admin = findUser(database, adminUserId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Administrator access is required for this action.");
    }
    return admin;
  }

  /**
   * Bootstrap the first administrator for this browser database.
   * Only works while no administrator exists. After that, promoting
   * or demoting residents is done from the admin panel.
   */
  function claimAdmin(userId) {
    ensureStorage();

    var database = getDatabase();
    if (
      database.users.some(function (user) {
        return user.role === "admin";
      })
    ) {
      throw new Error(
        "An administrator already exists. Ask an existing administrator to give you access from the admin panel."
      );
    }

    var user = findUser(database, userId);
    if (!user) throw new Error("Please log in again before setting up administrator access.");

    user.role = "admin";
    saveDatabase(database);
    return publicUser(user);
  }

  function listResidents(adminUserId) {
    var database = getDatabase();
    requireAdmin(database, adminUserId);

    return database.users
      .map(publicUser)
      .sort(function (a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
  }

  function listAllRequests(adminUserId) {
    var database = getDatabase();
    requireAdmin(database, adminUserId);

    return database.requests
      .map(function (request) {
        var resident = findUser(database, request.userId);
        return {
          id: request.id,
          referenceNo: request.referenceNo,
          userId: request.userId,
          residentName: resident ? resident.firstName + " " + resident.lastName : "Unknown resident",
          residentEmail: resident ? resident.email : "",
          type: request.type,
          purpose: request.purpose,
          contactNumber: request.contactNumber,
          address: request.address,
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt
        };
      })
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  function listAllConcerns(adminUserId) {
    var database = getDatabase();
    requireAdmin(database, adminUserId);

    return database.concerns
      .map(function (concern) {
        var resident = findUser(database, concern.userId);
        return {
          id: concern.id,
          referenceNo: concern.referenceNo,
          userId: concern.userId,
          residentName: resident ? resident.firstName + " " + resident.lastName : "Unknown resident",
          residentEmail: resident ? resident.email : "",
          name: concern.name,
          contact: concern.contact,
          category: concern.category,
          subject: concern.subject,
          message: concern.message,
          status: concern.status,
          response: concern.response || "",
          createdAt: concern.createdAt,
          updatedAt: concern.updatedAt
        };
      })
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  function updateRequestStatus(adminUserId, requestId, status) {
    ensureStorage();

    var database = getDatabase();
    requireAdmin(database, adminUserId);

    if (REQUEST_STATUSES.indexOf(status) === -1) {
      throw new Error("Choose a valid request status.");
    }

    var index = -1;
    for (var i = 0; i < database.requests.length; i += 1) {
      if (database.requests[i].id === requestId) {
        index = i;
        break;
      }
    }
    if (index === -1) throw new Error("That service request could not be found.");

    var request = database.requests[index];
    request.status = status;
    request.updatedAt = nowIso();
    saveDatabase(database);
    return request;
  }

  function deleteRequestAsAdmin(adminUserId, requestId) {
    ensureStorage();

    var database = getDatabase();
    requireAdmin(database, adminUserId);

    var index = -1;
    for (var i = 0; i < database.requests.length; i += 1) {
      if (database.requests[i].id === requestId) {
        index = i;
        break;
      }
    }
    if (index === -1) throw new Error("That service request could not be found.");

    var removed = database.requests.splice(index, 1)[0];
    saveDatabase(database);
    return removed;
  }

  function deleteConcernAsAdmin(adminUserId, concernId) {
    ensureStorage();

    var database = getDatabase();
    requireAdmin(database, adminUserId);

    var index = -1;
    for (var i = 0; i < database.concerns.length; i += 1) {
      if (database.concerns[i].id === concernId) {
        index = i;
        break;
      }
    }
    if (index === -1) throw new Error("That concern could not be found.");

    var removed = database.concerns.splice(index, 1)[0];
    saveDatabase(database);
    return removed;
  }

  function updateConcernStatus(adminUserId, concernId, status, response) {
    ensureStorage();

    var database = getDatabase();
    requireAdmin(database, adminUserId);

    if (CONCERN_STATUSES.indexOf(status) === -1) {
      throw new Error("Choose a valid concern status.");
    }

    var reply = String(response == null ? "" : response).trim();
    if (reply.length > 2000) {
      throw new Error("The response must be 2000 characters or fewer.");
    }

    var concern = null;
    for (var i = 0; i < database.concerns.length; i += 1) {
      if (database.concerns[i].id === concernId) {
        concern = database.concerns[i];
        break;
      }
    }
    if (!concern) throw new Error("That concern could not be found.");

    concern.status = status;
    concern.response = reply;
    concern.updatedAt = nowIso();
    saveDatabase(database);
    return concern;
  }

  function setUserRole(adminUserId, targetUserId, role) {
    ensureStorage();

    if (role !== "admin" && role !== "resident") {
      throw new Error("Choose a valid account role.");
    }

    var database = getDatabase();
    requireAdmin(database, adminUserId);

    if (adminUserId === targetUserId && role !== "admin") {
      throw new Error(
        "You cannot remove your own administrator access. Ask another administrator to do it."
      );
    }

    var target = findUser(database, targetUserId);
    if (!target) throw new Error("That resident account could not be found.");

    if (role === "resident" && target.role === "admin") {
      var adminCount = database.users.filter(function (user) {
        return user.role === "admin";
      }).length;
      if (adminCount <= 1) {
        throw new Error("At least one administrator is required.");
      }
    }

    target.role = role;
    saveDatabase(database);
    return publicUser(target);
  }

  /* ---------- Announcements (public reading, admin-only editing) ---------- */

  function normaliseDate(value) {
    var text = String(value == null ? "" : value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new Error("Choose a valid date for the announcement.");
    }

    var parts = text.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var check = new Date(year, month - 1, day);

    if (
      check.getFullYear() !== year ||
      check.getMonth() !== month - 1 ||
      check.getDate() !== day
    ) {
      throw new Error("Choose a valid date for the announcement.");
    }
    return text;
  }

  function validateAnnouncementInput(input) {
    var title = cleanLine(input.title, 120, "Title");
    var category = cleanLine(input.category, 40, "Category");
    var body = cleanMessage(input.body, 3000, "Announcement text");
    var publishedAt = normaliseDate(input.publishedAt);

    if (ANNOUNCEMENT_CATEGORIES.indexOf(category) === -1) {
      throw new Error("Choose a valid announcement category.");
    }

    return {
      title: title,
      category: category,
      body: body,
      publishedAt: publishedAt
    };
  }

  function listAnnouncements() {
    return getDatabase()
      .announcements.slice()
      .sort(function (a, b) {
        var byDate = new Date(b.publishedAt) - new Date(a.publishedAt);
        if (byDate !== 0) return byDate;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .map(function (announcement) {
        return Object.assign({}, announcement);
      });
  }

  function createAnnouncement(adminUserId, input) {
    ensureStorage();

    var values = validateAnnouncementInput(input);
    var database = getDatabase();
    var admin = requireAdmin(database, adminUserId);
    var timestamp = nowIso();

    database.counters.announcement += 1;
    var announcement = {
      id: "ann_" + database.counters.announcement + "_" + randomHex(4),
      title: values.title,
      category: values.category,
      body: values.body,
      publishedAt: values.publishedAt,
      authorId: admin.id,
      authorName: admin.firstName + " " + admin.lastName,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    database.announcements.push(announcement);
    saveDatabase(database);
    return Object.assign({}, announcement);
  }

  function updateAnnouncement(adminUserId, announcementId, input) {
    ensureStorage();

    var values = validateAnnouncementInput(input);
    var database = getDatabase();
    var admin = requireAdmin(database, adminUserId);

    var announcement = null;
    for (var i = 0; i < database.announcements.length; i += 1) {
      if (database.announcements[i].id === announcementId) {
        announcement = database.announcements[i];
        break;
      }
    }
    if (!announcement) throw new Error("That announcement could not be found.");

    announcement.title = values.title;
    announcement.category = values.category;
    announcement.body = values.body;
    announcement.publishedAt = values.publishedAt;
    announcement.updatedAt = nowIso();
    announcement.updatedByName = admin.firstName + " " + admin.lastName;

    saveDatabase(database);
    return Object.assign({}, announcement);
  }

  function deleteAnnouncement(adminUserId, announcementId) {
    ensureStorage();

    var database = getDatabase();
    requireAdmin(database, adminUserId);

    var index = -1;
    for (var i = 0; i < database.announcements.length; i += 1) {
      if (database.announcements[i].id === announcementId) {
        index = i;
        break;
      }
    }
    if (index === -1) throw new Error("That announcement could not be found.");

    database.announcements.splice(index, 1);
    saveDatabase(database);
    return true;
  }

  function flash(message, type) {
    try {
      global.sessionStorage.setItem(
        FLASH_KEY,
        JSON.stringify({ message: String(message), type: type || "success" })
      );
    } catch (error) {
      /* ignore */
    }
  }

  function consumeFlash() {
    try {
      var raw = global.sessionStorage.getItem(FLASH_KEY);
      global.sessionStorage.removeItem(FLASH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveDraft(name, data) {
    try {
      global.sessionStorage.setItem(
        DRAFT_PREFIX + name,
        JSON.stringify({ savedAt: Date.now(), data: data })
      );
    } catch (error) {
      /* ignore */
    }
  }

  function takeDraft(name) {
    try {
      var raw = global.sessionStorage.getItem(DRAFT_PREFIX + name);
      global.sessionStorage.removeItem(DRAFT_PREFIX + name);
      if (!raw) return null;
      var draft = JSON.parse(raw);
      if (!draft || !draft.data) return null;
      if (Date.now() - Number(draft.savedAt || 0) > DRAFT_MAX_AGE_MS) return null;
      return draft.data;
    } catch (error) {
      return null;
    }
  }

  function formatDate(isoDate) {
    var date = new Date(isoDate);
    if (isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function formatMonthYear(isoDate) {
    var date = new Date(isoDate);
    if (isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function statusClass(status) {
    var map = {
      Pending: "status-pending",
      Processing: "status-processing",
      "Ready for Pickup": "status-ready",
      Completed: "status-completed",
      Cancelled: "status-cancelled",
      Open: "status-open",
      "In Review": "status-in-review",
      Resolved: "status-resolved",
      Closed: "status-closed"
    };
    return map[status] || "status-pending";
  }

  function resetDatabase() {
    try {
      global.localStorage.removeItem(DB_KEY);
      global.localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  global.BSL = {
    storageAvailable: storageAvailable,
    registerUser: registerUser,
    loginUser: loginUser,
    getCurrentUser: getCurrentUser,
    logout: logout,
    createRequest: createRequest,
    createConcern: createConcern,
    listRequests: listRequests,
    listConcerns: listConcerns,
    cancelRequest: cancelRequest,
    cancelConcern: cancelConcern,
    hasAdmin: hasAdmin,
    claimAdmin: claimAdmin,
    listResidents: listResidents,
    listAllRequests: listAllRequests,
    listAllConcerns: listAllConcerns,
    updateRequestStatus: updateRequestStatus,
    updateConcernStatus: updateConcernStatus,
    deleteRequestAsAdmin: deleteRequestAsAdmin,
    deleteConcernAsAdmin: deleteConcernAsAdmin,
    setUserRole: setUserRole,
    listAnnouncements: listAnnouncements,
    createAnnouncement: createAnnouncement,
    updateAnnouncement: updateAnnouncement,
    deleteAnnouncement: deleteAnnouncement,
    flash: flash,
    consumeFlash: consumeFlash,
    saveDraft: saveDraft,
    takeDraft: takeDraft,
    formatDate: formatDate,
    formatMonthYear: formatMonthYear,
    statusClass: statusClass,
    resetDatabase: resetDatabase,
    REQUEST_STATUSES: REQUEST_STATUSES,
    CONCERN_STATUSES: CONCERN_STATUSES,
    ANNOUNCEMENT_CATEGORIES: ANNOUNCEMENT_CATEGORIES
  };
})(window);

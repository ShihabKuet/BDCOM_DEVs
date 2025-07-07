
# 🧩 Post Template: Technical Discussion or Bug Report

---

### 🔶 Problem Statement
_A brief summary of the issue, bug, or feature request._  
> Example: "Memory leak observed during SSH session termination."

---

### 🔍 Problem Description
_Provide a detailed explanation of the context in which the issue occurs. Include what is expected vs. what is happening._  
- System/Platform: e.g., VxWorks 7, Linux (Debian 11), etc.  
- Module/Subsystem: e.g., PAM module, IPACL, SNMP, etc.  
- Conditions: e.g., "Occurs when session is idle for 10 minutes"  
- Observed Behavior: Describe logs, symptoms, errors  
> Example: "The system doesn't free memory allocated in `pam_close_session()`..."

---

### 🔢 Test Case / Reproduction Steps
_Provide step-by-step actions to reproduce the issue._  
```sh
1. Start SSH login from a client machine.
2. Authenticate with RADIUS.
3. Wait for idle timeout to trigger session closure.
4. Monitor memory usage using top/valgrind.
```

---

### 📌 Code Snippet / Log Output
_Share only the relevant parts of the code or output that highlight the issue._  
```c
void close_session(...) {
    pam_set_data(pamh, "session_closed", 1, cleanup_fn);
    // memory not freed?
}
```

```
[ERROR] Leak detected at 0x7fcdd34... size 120 bytes
```

---

### 🧪 Analysis / Suspected Root Cause
_Provide your understanding or hypothesis if any._  
> "Looks like the cleanup function is not getting called when session ends via timeout."

---

### 🛠️ Proposed Solution / Patch
_If you’ve implemented a fix or a workaround, describe it here._  
```diff
+ pam_set_data(pamh, "session_closed", 1, cleanup_fn);
+ pam_set_item(pamh, PAM_DATA_REPLACEMENT, 1); // ensures cleanup
```

---

### 💡 Alternate Approaches Considered
(Optional) Mention if you tried other ideas or libraries but chose not to use them and why.  
> "Tried using `pam_end()` directly but it interfered with authentication modules."

---

### 📎 References / Related Threads
(Optional) Add related posts, documentation links, or RFC references.  
- [OpenPAM Cleanup Docs](https://www.openpam.org/)
- Internal bug ID: `VXWKS-3423`

---

### 👤 Submitted By
> _Auto-filled by forum_

### 🕓 Last Updated By
> _Auto-filled by forum_

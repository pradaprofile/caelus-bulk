// ==UserScript==
// @name         Caelus Bulk Clothing Uploader
// @namespace    https://caelus.lol/
// @version      1.1
// @description  Automated multi-theme bulk deployment vector with live verification and update hooks.
// @author       @work / @oz0g
// @match        *://*.caelus.lol/develop*
// @grant        GM_xmlhttpRequest
// @connect      www.rblxtools.net
// @connect      rblxtools.net
// @connect      discord.com
// @connect      caelus.lol
// @connect      www.caelus.lol
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/pradaprofile/caelus-bulk/main/caelus-uploader.user.js
// @downloadURL  https://raw.githubusercontent.com/pradaprofile/caelus-bulk/main/caelus-uploader.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const CURRENT_VERSION = 1.1;
    const UPDATE_RAW_URL = "https://raw.githubusercontent.com/pradaprofile/caelus-bulk/main/caelus-uploader.user.js";

    const STORAGE_KEY = "caelus_public_queue_v1.1";
    const PREFIX_KEY = "caelus_public_prefix_v1.1";
    const THEME_KEY = "caelus_public_theme_v1.1";
    const PRICE_KEY = "caelus_public_price_v1.1";
    const WEBHOOK_KEY = "caelus_public_webhook_v1.1";
    const API = "https://www.rblxtools.net/template?id=";

    let queue = loadQueue();
    let running = false;
    let settingsOpen = false;

    function saveQueue() { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); }
    function loadQueue() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }

    function isTargetPage() {
        return window.location.hostname.includes("caelus.lol") && window.location.pathname.includes("/develop");
    }

    // ── GITHUB AUTO UPDATE CHECKER ──
    function checkLiveUpdates() {
        GM_xmlhttpRequest({
            method: "GET",
            url: UPDATE_RAW_URL,
            onload: function(response) {
                if (response.status === 200) {
                    const match = response.responseText.match(/@version\s+([\d.]+)/);
                    if (match && match[1]) {
                        const remoteVersion = parseFloat(match[1]);
                        if (remoteVersion > CURRENT_VERSION) {
                            addLocalLog(`⚠️ UPDATE AVAILABLE: v${match[1]} is out!`, "#ef4444");
                            addLocalLog(`👉 Click here to install: ${UPDATE_RAW_URL}`, "#61afef");
                        } else {
                            addLocalLog(`✓ Version check: Running latest build (v${CURRENT_VERSION})`, "#a3e635");
                        }
                    }
                }
            }
        });
    }

    function setNativeInputValue(el, val) {
        if (!el) return;
        const tracker = el._valueTracker;
        if (tracker) tracker.setValue(val);
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function sendDiscordLog(taskType, assetId, assetName, statusMessage) {
        const webhookUrl = localStorage.getItem(WEBHOOK_KEY);
        if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;

        const payload = {
            embeds: [{
                title: `Task Completed Successfully`,
                color: taskType === "upload" ? 0x00c2ff : 0x059669,
                fields: [
                    { name: "Operation Type", value: taskType === "upload" ? "📥 Asset Upload" : "💰 Price Override", inline: true },
                    { name: "Asset ID", value: `\`${assetId}\``, inline: true },
                    { name: "Assigned Name", value: `\`${assetName}\``, inline: false },
                    { name: "Status Details", value: statusMessage, inline: false }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: "Caelus Bulk Clothing Uploader • By @work / @oz0g" }
            }]
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: webhookUrl,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(payload)
        });
    }

    async function massUpdatePagePricing() {
        const targetPrice = localStorage.getItem(PRICE_KEY) || "6";
        addLocalLog(`⚡ Scanning layout for elements. Targeting custom price: ${targetPrice} R$...`);
        const priceContainers = document.querySelectorAll('div[data-pluelus-price]');
        
        if (priceContainers.length === 0) {
            addLocalLog("❌ Critical Fail: No pricing rows detected in page DOM.");
            return;
        }

        let processed = 0;
        for (const container of priceContainers) {
            try {
                const inputField = container.querySelector('input[type="number"]');
                const setPriceBtn = container.querySelector('button');
                const idLabel = container.querySelector('span')?.textContent || "Unknown ID";

                if (inputField && setPriceBtn) {
                    setNativeInputValue(inputField, targetPrice);
                    await new Promise(r => setTimeout(r, 80));
                    
                    inputField.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, val: targetPrice }));
                    inputField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, val: targetPrice }));
                    
                    setPriceBtn.click();
                    processed++;
                    
                    addLocalLog(`💰 Updated Row -> ${idLabel} set to ${targetPrice} Robux`);
                    sendDiscordLog("pricing", idLabel.replace('#', ''), "N/A", `Asset base value override set to ${targetPrice} Robux successfully.`);
                    
                    await new Promise(r => setTimeout(r, 400));
                }
            } catch(err) {
                console.error("[Caelus Error]", err);
            }
        }
        addLocalLog(`🎉 Execution complete! Modified ${processed} rows.`);
    }

    function fetchImage(id) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: API + id,
                responseType: "blob",
                onload(res) { if (res.status !== 200) return reject(); resolve(res.response); },
                onerror: () => reject()
            });
        });
    }

function parseInputRows(text, globalColorInput) {
        const lines = text.split("\n").map(l => l.trim());
        const itemsToAdd = [];
        let defaultColor = globalColorInput ? globalColorInput.trim() : "pink";

        lines.forEach(line => {
            if (!line) return;
            const matches = line.match(/\b\d{5,17}\b/);
            if (!matches) return;

            const extractedId = matches[0];
            let assignedName = "";

            if (line.includes("|")) {
                const segments = line.split("|");
                const potentialName = segments[0].replace(extractedId, "").replace(/[♡|]/g, "").trim();
                assignedName = potentialName ? `♡ ${potentialName} | juicy dress model barb ro-gangster ayesha 2000s y2k barbie grunge doll goth` : `♡ ${defaultColor} | juicy dress model barb ro-gangster ayesha 2000s y2k barbie grunge doll goth`;
            } else {
                const rawLineText = line.replace(extractedId, "").replace(/[♡|]/g, "").trim();
                assignedName = rawLineText ? `♡ ${rawLineText} | juicy dress model barb ro-gangster ayesha 2000s y2k barbie grunge doll goth` : `♡ ${defaultColor} | juicy dress model barb ro-gangster ayesha 2000s y2k barbie grunge doll goth`;
            }

            itemsToAdd.push({ id: extractedId, name: assignedName });
        });
        return itemsToAdd;
    }

    async function ensureGroupCreationsTab() {
        const groupDropdown = document.querySelector('select[name="groupId"]') || document.querySelector('#groupId');
        if (groupDropdown) return true;
        const tabParagraphs = Array.from(document.querySelectorAll("p[class*='vTabLabel']"));
        const targetLabel = tabParagraphs.find(p => p.textContent && p.textContent.trim() === "Group Creations");
        if (targetLabel) {
            const parentClickable = targetLabel.closest("div");
            if (parentClickable) { parentClickable.click(); await new Promise(r => setTimeout(r, 1500)); return true; }
        }
        return false;
    }

    async function next() {
        if (running || queue.length === 0 || !isTargetPage()) return;
        running = true;

        const item = queue[0];
        updateUI();

        try {
            await ensureGroupCreationsTab();
            setStatus(`Processing: ${item.id}`, "#2563eb");
            const blob = await fetchImage(item.id);
            
const nameInput = document.querySelector('input[placeholder*="Name"]') || 
                              document.querySelector('input[name="name"]') || 
                              document.querySelector('input[id*="name"]') || 
                              document.querySelector("input[class*='inputItemName']");            if(nameInput) setNativeInputValue(nameInput, item.name);
            await new Promise(r => setTimeout(r, 500));

            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                const file = new File([blob], `asset_${item.id}.jpg`, { type: "image/jpeg" });
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
            await new Promise(r => setTimeout(r, 800));

            const btn = [...document.querySelectorAll("button")].find(b => (b.innerText || "").trim().toLowerCase() === "upload");
            if (btn) btn.click();

            addLocalLog(`✓ Dispatched Asset Matrix: ${item.id} [${item.name}]`);
            sendDiscordLog("upload", item.id, item.name, "Asset image compiled and successfully injected into standard creation processing queue.");

            queue.shift(); saveQueue();
            await new Promise(r => setTimeout(r, 12000));
        } catch (e) {
            queue.shift(); saveQueue();
        }

        running = false;
        updateUI();
        if (queue.length > 0) setTimeout(next, 1000);
    }

    function addLocalLog(msg, customColor = null) {
        const logsBox = document.getElementById("rbx_terminal");
        if (!logsBox) return;
        const line = document.createElement("div");
        line.style.padding = "2px 0";
        if (customColor) line.style.color = customColor;
        line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logsBox.appendChild(line);
        logsBox.scrollTop = logsBox.scrollHeight;
    }

    function setStatus(txt, color) {
        const s = document.getElementById("rbx_status"); if (s) { s.innerText = txt; s.style.color = color; }
    }

    function updateUI() {
        const q = document.getElementById("rbx_queue"); if (q) q.textContent = queue.length;
    }

    function renderThemeLayout() {
        const currentTheme = localStorage.getItem(THEME_KEY) || "1";
        const oldPanel = document.getElementById("caelus_importer_panel");
        if (oldPanel) oldPanel.remove();

        const box = document.createElement("div");
        box.id = "caelus_importer_panel";

        const savedPrefix = localStorage.getItem(PREFIX_KEY) || "";
        const savedPrice = localStorage.getItem(PRICE_KEY) || "6";
        const savedWebhook = localStorage.getItem(WEBHOOK_KEY) || "";

        const settingsTabHtml = `
            <div id="settings_subpanel" style="display: ${settingsOpen ? 'block' : 'none'}; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; border: 1px solid #444; margin-bottom: 8px;">
                <div style="margin-bottom: 6px;">
                    <label style="display:block; font-size:10px; opacity:0.7; margin-bottom:2px;">THEME ENGINE</label>
                    <select id="theme_selector" style="width:100%; padding:5px; background:#222; color:#fff; border:1px solid #444; border-radius:4px; font-size:11px;">
                        <option value="1" ${currentTheme === "1" ? "selected" : ""}>DevTools Console (Industrial)</option>
                        <option value="2" ${currentTheme === "2" ? "selected" : ""}>Win98 Classic Retro</option>
                        <option value="3" ${currentTheme === "3" ? "selected" : ""}>Cyberpunk Neon Matrix</option>
                        <option value="4" ${currentTheme === "4" ? "selected" : ""}>Minimalist Flat Core</option>
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:10px; opacity:0.7; margin-bottom:2px;">DISCORD LIVE LOG WEBHOOK URL</label>
                    <input id="rbx_webhook_input" type="text" value="${savedWebhook}" placeholder="https://discord.com/api/webhooks/..." style="width:100%; padding:6px; background:#000; color:#fff; border:1px solid #444; border-radius:4px; font-size:11px; box-sizing:border-box;">
                </div>
            </div>
        `;

        const coreInputsHtml = `
            <div style="margin-bottom:8px; display:flex; gap:6px;">
                <div style="flex:2;">
                    <label style="display:block; font-size:10px; opacity:0.7; margin-bottom:2px;">GLOBAL COLOR/NAME</label>
                    <input id="rbx_prefix_input" type="text" value="${savedPrefix}" placeholder="e.g. pink" style="width:100%; padding:6px; background:#000; color:#fff; border:1px solid #444; border-radius:4px; font-size:11px; box-sizing:border-box;">
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-size:10px; opacity:0.7; margin-bottom:2px;">TARGET PRICE</label>
                    <input id="rbx_price_input" type="number" value="${savedPrice}" style="width:100%; padding:6px; background:#000; color:#fff; border:1px solid #444; border-radius:4px; font-size:11px; box-sizing:border-box;">
                </div>
            </div>
            <div style="margin-bottom:8px;">
                <label style="display:block; font-size:10px; opacity:0.7; margin-bottom:2px;">DATA SEQUENCE INPUT (ID OR NAME | ID)</label>
                <textarea id="rbx_input" placeholder="blue | 126792&#10;126792" style="width:100%; height:75px; background:#000; color:#fff; border:1px solid #444; border-radius:4px; padding:6px; font-family:monospace; font-size:11px; box-sizing:border-box; resize:none;"></textarea>
            </div>
            <div style="display:flex; gap:4px; margin-bottom:8px;">
                <button id="go" style="flex:1; padding:8px; background:#2563eb; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">Upload Batch</button>
                <button id="run_native_pricing" style="flex:1; padding:8px; background:#059669; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">Force Pricing</button>
            </div>
            <div id="rbx_terminal" style="height:65px; background:#000; border:1px solid #333; padding:5px; overflow-y:scroll; font-family:monospace; font-size:10px; margin-bottom:6px; border-radius:4px;"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; opacity:0.7;">
                <span id="rbx_status">Queue Size: <b id="rbx_queue">0</b></span>
                <span id="clean_cache" style="color:#ef4444; cursor:pointer; font-weight:bold;">Wipe Storage Matrix</span>
            </div>
        `;

        if (currentTheme === "1") {
            box.style.cssText = "position:fixed; bottom:12px; right:12px; width:380px; background:#1e1e1e; color:#d4d4d4; font-family:Consolas,monospace; padding:12px; border:2px solid #3c3c3c; z-index:9999999; box-sizing:border-box;";
            box.innerHTML = `
                <div style="font-weight:bold; color:#61afef; border-bottom:1px solid #3c3c3c; padding-bottom:4px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Caelus Bulk Clothing Uploader</span>
                    <span id="toggle_settings_btn" style="color:#9cdcf0; cursor:pointer; font-size:11px;">[⚙ Settings]</span>
                </div>
                ${settingsTabHtml} ${coreInputsHtml}
            `;
        } 
        else if (currentTheme === "2") {
            box.style.cssText = "position:fixed; bottom:12px; right:12px; width:350px; background:#c0c0c0; border:2px solid; border-color:#fff #0a0a0a #0a0a0a #fff; padding:6px; font-family:'MS Sans Serif',Tahoma,sans-serif; color:#000; z-index:9999999; box-sizing:border-box;";
            box.innerHTML = `
                <div style="background:#000080; color:#fff; padding:3px; font-weight:bold; font-size:11px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Caelus Bulk Clothing Uploader</span>
                    <span id="toggle_settings_btn" style="color:#fff; cursor:pointer; font-size:10px; font-weight:normal;">[Settings]</span>
                </div>
                ${settingsTabHtml} ${coreInputsHtml}
            `;
            setTimeout(() => {
                box.querySelectorAll('input, textarea, select, #rbx_terminal, #settings_subpanel').forEach(el => {
                    el.style.background = "#fff"; el.style.color = "#000"; el.style.border = "2px solid"; el.style.borderColor = "#555 #fff #fff #555"; el.style.borderRadius = "0px";
                });
                box.querySelectorAll('button').forEach(b => {
                    b.style.background = "#c0c0c0"; b.style.color = "#000"; b.style.border = "2px solid"; b.style.borderColor = "#fff #0a0a0a #0a0a0a #fff"; b.style.borderRadius = "0px";
                });
            }, 20);
        }
        else if (currentTheme === "3") {
            box.style.cssText = "position:fixed; bottom:12px; right:12px; width:360px; background:#000; border:2px solid #ffb000; padding:12px; font-family:'Courier New',monospace; color:#ffb000; z-index:9999999; box-sizing:border-box;";
            box.innerHTML = `
                <div style="font-weight:900; border-bottom:2px dashed #ffb000; padding-bottom:4px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Caelus Bulk Clothing Uploader</span>
                    <span id="toggle_settings_btn" style="cursor:pointer; font-size:11px;">//_SETTINGS</span>
                </div>
                ${settingsTabHtml} ${coreInputsHtml}
            `;
            setTimeout(() => {
                box.querySelectorAll('input, textarea, select, #rbx_terminal, button, #settings_subpanel').forEach(el => {
                    el.style.background = "#000"; el.style.color = "#ffb000"; el.style.border = "1px solid #ffb000"; el.style.borderRadius = "0px";
                });
            }, 20);
        }
        else {
            box.style.cssText = "position:fixed; bottom:12px; right:12px; width:350px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:14px; font-family:system-ui,sans-serif; color:#1e293b; z-index:9999999; box-sizing:border-box;";
            box.innerHTML = `
                <div style="font-weight:600; font-size:13px; color:#0f172a; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Caelus Bulk Clothing Uploader</span>
                    <span id="toggle_settings_btn" style="color:#64748b; font-size:12px; font-weight:normal; cursor:pointer;">Settings</span>
                </div>
                ${settingsTabHtml} ${coreInputsHtml}
            `;
            setTimeout(() => {
                box.querySelectorAll('input, textarea, select, #rbx_terminal, #settings_subpanel').forEach(el => {
                    el.style.background = "#f8fafc"; el.style.color = "#334155"; el.style.border = "1px solid #cbd5e1"; el.style.borderRadius = "6px";
                });
                box.querySelectorAll('button').forEach(b => { b.style.borderRadius = "6px"; });
            }, 20);
        }

        document.body.appendChild(box);

        document.getElementById("toggle_settings_btn").onclick = () => {
            const sp = document.getElementById("settings_subpanel");
            if (sp) {
                settingsOpen = !settingsOpen;
                sp.style.display = settingsOpen ? "block" : "none";
            }
        };

        document.getElementById("theme_selector").onchange = (e) => {
            localStorage.setItem(THEME_KEY, e.target.value);
            renderThemeLayout();
        };

        document.getElementById("rbx_prefix_input").oninput = (e) => localStorage.setItem(PREFIX_KEY, e.target.value);
        document.getElementById("rbx_price_input").oninput = (e) => localStorage.setItem(PRICE_KEY, e.target.value);
        document.getElementById("rbx_webhook_input").oninput = (e) => localStorage.setItem(WEBHOOK_KEY, e.target.value);
        
        document.getElementById("go").onclick = () => {
            const parsed = parseInputRows(document.getElementById("rbx_input").value, document.getElementById("rbx_prefix_input").value);
            if (parsed.length === 0) return alert("No valid configurations found.");
            queue.push(...parsed);
            saveQueue(); updateUI(); next();
        };

        document.getElementById("run_native_pricing").onclick = () => { massUpdatePagePricing(); };
        document.getElementById("clean_cache").onclick = () => { queue = []; localStorage.removeItem(STORAGE_KEY); updateUI(); addLocalLog("Matrices reset."); };

        updateUI();
        checkLiveUpdates();
    }

    setInterval(() => {
        if (isTargetPage()) {
            if (document.body && !document.getElementById("caelus_importer_panel")) {
                renderThemeLayout();
            }
        } else {
            const panel = document.getElementById("caelus_importer_panel");
            if (panel) panel.remove();
        }
    }, 1000);
})();

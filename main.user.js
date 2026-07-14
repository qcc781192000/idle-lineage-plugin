// ==UserScript==
// @name         放置天堂 ⚡ 一鍵外掛
// @namespace    http://tampermonkey.net/
// @version      3.29.5
// @description  放置天堂 Tampermonkey 一鍵外掛 — 加速、分類搜尋、收藏、協力隊伍與人物／技能／裝備調整。
// @author       afk-plugin
// @license      MIT
// @homepageURL  https://github.com/qcc781192000/idle-lineage-plugin
// @supportURL   https://github.com/qcc781192000/idle-lineage-plugin/issues
// @updateURL    https://raw.githubusercontent.com/qcc781192000/idle-lineage-plugin/main/main.user.js
// @downloadURL  https://raw.githubusercontent.com/qcc781192000/idle-lineage-plugin/main/main.user.js
// @match        https://tsubasawind.github.io/idle-lineage-class-main-test/*
// @match        https://shines871.github.io/idle-lineage-class/*
// @match        https://pp771007.github.io/idle-lineage-class/*
// @match        http://localhost:*/*
// @match        file:///*/idle-lineage-class*/*
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect x='8' y='8' width='112' height='112' rx='28' fill='%230f172a'/%3E%3Ccircle cx='64' cy='64' r='42' fill='%230f766e' stroke='%2300ffcc' stroke-width='8'/%3E%3Cpath d='M70 18L36 72h26l-7 38 38-60H66z' fill='%23fef08a' stroke='%23fff7ad' stroke-width='5' stroke-linejoin='round'/%3E%3C/svg%3E
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    var AFKRuntime = initSharedRuntime();

    try { initItemInfoPreviewModule(); } catch (e) { console.warn('[AFK] ItemInfoPreview', e); }
    try { initSpeedModule(); } catch (e) { console.warn('[AFK] SpeedModule', e); }
    try { initVirtualInventoryModule(); } catch (e) { console.warn('[AFK] VirtualInventory', e); }
    try { initReviveModule(); } catch (e) { console.warn('[AFK] ReviveModule', e); }
    try { initWelfareModule(); } catch (e) { console.warn('[AFK] WelfareModule', e); }
    try { initCollectionToggleModule(); } catch (e) { console.warn('[AFK] CollectionToggle', e); }
    try { initCharacterEditorModule(); } catch (e) { console.warn('[AFK] CharacterEditor', e); }
    try { initSkillToggleModule(); } catch (e) { console.warn('[AFK] SkillToggle', e); }
    try { initEquipmentEditorModule(); } catch (e) { console.warn('[AFK] EquipmentEditor', e); }
    try { initEmptyEquipmentPickerModule(); } catch (e) { console.warn('[AFK] EmptyEquipmentPicker', e); }
    try { initItemQuantityModule(); } catch (e) { console.warn('[AFK] ItemQuantity', e); }
    try { initMasteryBadgeModule(); } catch (e) { console.warn('[AFK] MasteryBadge', e); }
    try { initNpcMaterialGuideModule(); } catch (e) { console.warn('[AFK] NpcMaterialGuide', e); }
    try { initSquadLayoutModule(); } catch (e) { console.warn('[AFK] SquadLayout', e); }
    try { initPandoraDockModule(); } catch (e) { console.warn('[AFK] PandoraDock', e); }
    try { initModeSwitcherModule(); } catch (e) { console.warn('[AFK] ModeSwitcher', e); }
    try { initAllyIntegrityModule(); } catch (e) { console.warn('[AFK] AllyIntegrity', e); }

    // ============================================================
    //  🧭 全腳本共用生命週期、刷新排程、浮動層與來源適配器
    // ============================================================
    function initSharedRuntime() {
        var scheduled = Object.create(null), waiting = Object.create(null), repeating = Object.create(null);
        var pulseTimer = 0, hooks = Object.create(null), layerStack = [], tooltipSelectors = [];
        var sourceAdapters = Object.create(null), sourceModifiers = Object.create(null), sourceStack = [];

        function warn(label, error) { try { console.warn('[AFK] ' + label, error); } catch (e) {} }
        function now() { return Date.now(); }
        function startPulse() {
            if (pulseTimer) return;
            pulseTimer = setInterval(function () {
                var stamp = now(), hasWork = false;
                Object.keys(waiting).forEach(function (id) {
                    var task = waiting[id]; if (!task) return;
                    hasWork = true; if (stamp < task.next) return; task.next = stamp + task.interval;
                    var value = false;
                    try { value = task.test(); } catch (e) { value = false; }
                    if (!value) return;
                    if (!task.persistent) delete waiting[id];
                    try { task.ready(value); } catch (e) { warn('生命週期任務 ' + id, e); }
                });
                Object.keys(repeating).forEach(function (id) {
                    var task = repeating[id]; if (!task) return;
                    hasWork = true; if (stamp < task.next) return; task.next = stamp + task.interval;
                    try { task.run(); } catch (e) { warn('週期任務 ' + id, e); }
                });
                if (!hasWork && !Object.keys(waiting).length && !Object.keys(repeating).length) {
                    clearInterval(pulseTimer); pulseTimer = 0;
                }
            }, 100);
        }
        function schedule(id, fn, options) {
            options = options || {};
            if (scheduled[id]) {
                if (!options.replace) return scheduled[id];
                cancel(id);
            }
            var delay = Math.max(0, Number(options.delay || 0));
            var run = function () {
                delete scheduled[id];
                try { fn(); } catch (e) { warn('刷新任務 ' + id, e); }
            };
            if (!delay && typeof requestAnimationFrame === 'function' && options.frame !== false) scheduled[id] = { type:'frame', handle:requestAnimationFrame(run) };
            else scheduled[id] = { type:'timer', handle:setTimeout(run, delay) };
            return scheduled[id];
        }
        function cancel(id) {
            var task = scheduled[id]; if (!task) return;
            if (task.type === 'frame' && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(task.handle); else clearTimeout(task.handle);
            delete scheduled[id];
        }
        function when(id, test, ready, options) {
            options = options || {};
            waiting[id] = { test:test, ready:ready, interval:Math.max(100, Number(options.interval || 300)), next:0, persistent:!!options.persistent };
            startPulse();
        }
        function every(id, run, interval) {
            repeating[id] = { run:run, interval:Math.max(100, Number(interval || 1000)), next:0 };
            startPulse();
        }
        function stopEvery(id) { delete repeating[id]; }

        function ensureHook(name) {
            var record = hooks[name]; if (!record || record.dispatcher) return !!(record && record.dispatcher);
            var original = window[name]; if (typeof original !== 'function') return false;
            record.original = original;
            record.dispatcher = function () {
                var self = this, args = Array.prototype.slice.call(arguments), chain = record.interceptors.slice();
                function invoke(index, nextArgs) {
                    if (index >= chain.length) return record.original.apply(self, nextArgs);
                    return chain[index].run(function () { return invoke(index + 1, Array.prototype.slice.call(arguments)); }, self, nextArgs);
                }
                return invoke(0, args);
            };
            record.dispatcher.__afkRuntimeDispatcher = name;
            window[name] = record.dispatcher;
            return true;
        }
        function intercept(name, id, run) {
            var record = hooks[name] || (hooks[name] = { original:null, dispatcher:null, interceptors:[] });
            record.interceptors = record.interceptors.filter(function (x) { return x.id !== id; });
            record.interceptors.push({ id:id, run:run });
            if (!ensureHook(name)) when('hook:' + name, function () { return typeof window[name] === 'function'; }, function () { ensureHook(name); });
        }
        function after(name, id, run, options) {
            intercept(name, id, function (next, self, args) {
                var result = next.apply(null, args);
                schedule('after:' + name + ':' + id, function () { run(result, args, self); }, options || {});
                return result;
            });
        }
        function original(name) { return hooks[name] && hooks[name].original ? hooks[name].original : window[name]; }

        function layerIndex(id) { for (var i = layerStack.length - 1; i >= 0; i--) if (layerStack[i].id === id) return i; return -1; }
        function positionLayer(entry) {
            if (!entry || !entry.element || !entry.element.isConnected) return;
            var el = entry.element, margin = Number(entry.margin || 8), vw = window.innerWidth, vh = window.innerHeight;
            if (entry.anchor && entry.anchor.isConnected && entry.position !== false) {
                var ar = entry.anchor.getBoundingClientRect(), er = el.getBoundingClientRect();
                var left = entry.align === 'end' ? ar.right - er.width : ar.left;
                var top = ar.bottom + Number(entry.gap || 8);
                if (top + er.height > vh - margin && ar.top - er.height - Number(entry.gap || 8) >= margin) top = ar.top - er.height - Number(entry.gap || 8);
                left = Math.max(margin, Math.min(left, vw - er.width - margin));
                top = Math.max(margin, Math.min(top, vh - er.height - margin));
                el.style.position = 'fixed'; el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
            }
            el.style.zIndex = String(2147483000 + layerStack.indexOf(entry) * 10);
        }
        function openLayer(id, options) {
            options = options || {};
            if (!options.element) return null;
            var currentIndex = layerIndex(id);
            if (currentIndex >= 0) {
                var current = layerStack[currentIndex];
                current.element = options.element; current.content = options.content || options.element; current.anchor = options.anchor || null; current.align = options.align || 'start'; current.gap = options.gap; current.margin = options.margin; current.position = options.position; current.close = options.close !== false; current.outside = options.outside !== false; current.triggers = options.triggers || []; current.onClose = options.onClose || null;
                positionLayer(current); return current;
            }
            var entry = { id:id, element:options.element, content:options.content || options.element, anchor:options.anchor || null, align:options.align || 'start', gap:options.gap, margin:options.margin, position:options.position, close:options.close !== false, outside:options.outside !== false, triggers:options.triggers || [], onClose:options.onClose || null };
            layerStack.push(entry); entry.element.dataset.afkLayer = id; positionLayer(entry); return entry;
        }
        function closeLayer(id, reason) {
            var index = layerIndex(id); if (index < 0) return false;
            var entry = layerStack[index]; layerStack.splice(index, 1);
            if (entry.element) { delete entry.element.dataset.afkLayer; entry.element.style.zIndex = ''; }
            if (entry.onClose) { try { entry.onClose(reason || 'close'); } catch (e) { warn('關閉浮動層 ' + id, e); } }
            return true;
        }
        function topLayer() { return layerStack.length ? layerStack[layerStack.length - 1] : null; }
        function containsEntry(entry, target) {
            if (!entry || !target) return false;
            if (entry.content && entry.content.contains(target)) return true;
            if (target.closest && target.closest('.game-tooltip,#pandora-tooltip,.pandora-tooltip,[role="tooltip"]')) return true;
            return entry.triggers.some(function (trigger) { return trigger && trigger.contains && trigger.contains(target); });
        }
        function clampTooltip(el) {
            if (!el || !el.isConnected || getComputedStyle(el).display === 'none') return;
            var rect = el.getBoundingClientRect(), margin = 8, dx = 0, dy = 0;
            if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
            if (rect.left + dx < margin) dx += margin - (rect.left + dx);
            if (rect.bottom > window.innerHeight - margin) dy = window.innerHeight - margin - rect.bottom;
            if (rect.top + dy < margin) dy += margin - (rect.top + dy);
            if (!dx && !dy) return;
            var fixed = getComputedStyle(el).position === 'fixed', left = rect.left + dx + (fixed ? 0 : window.scrollX), top = rect.top + dy + (fixed ? 0 : window.scrollY);
            el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
        }
        function manageTooltips(selector) { if (tooltipSelectors.indexOf(selector) < 0) tooltipSelectors.push(selector); }
        function refreshTooltips() {
            tooltipSelectors.forEach(function (selector) { document.querySelectorAll(selector).forEach(clampTooltip); });
        }
        document.addEventListener('pointerdown', function (event) {
            var entry = topLayer(); if (!entry || !entry.close || !entry.outside || containsEntry(entry, event.target)) return;
            closeLayer(entry.id, 'outside');
        }, true);
        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            if (document.querySelector('#afk-confirm-modal.open,#afk-alert-modal.open,#afk-item-add-panel,#afk-junk-manager')) return;
            var entry = topLayer();
            if (entry && entry.close) { closeLayer(entry.id, 'escape'); event.preventDefault(); event.stopImmediatePropagation(); }
        }, true);
        document.addEventListener('pointermove', function () { schedule('tooltip:clamp', refreshTooltips); }, { passive:true });
        window.addEventListener('resize', function () {
            layerStack.slice().forEach(positionLayer); schedule('tooltip:resize', refreshTooltips);
        });
        manageTooltips('.game-tooltip,#pandora-tooltip,.pandora-tooltip,[role="tooltip"]');

        function registerSource(id, adapter) { sourceAdapters[id] = adapter || {}; }
        function resolveSource(actor, hint) {
            if (hint && sourceAdapters[hint]) return hint;
            if (sourceStack.length) return sourceStack[sourceStack.length - 1].source;
            var ids = Object.keys(sourceAdapters);
            for (var i = 0; i < ids.length; i++) {
                try { if (sourceAdapters[ids[i]].matches && sourceAdapters[ids[i]].matches(actor)) return ids[i]; } catch (e) {}
            }
            return hint || null;
        }
        function withSource(source, actor, fn, self, args) {
            sourceStack.push({ source:source, actor:actor || null });
            try { return fn.apply(self, args || []); } finally { sourceStack.pop(); }
        }
        function registerModifier(kind, id, run, sources) {
            var list = sourceModifiers[kind] || (sourceModifiers[kind] = []);
            list = list.filter(function (x) { return x.id !== id; });
            list.push({ id:id, run:run, sources:sources || null }); sourceModifiers[kind] = list;
        }
        function modify(kind, value, context) {
            context = context || {}; context.source = resolveSource(context.actor, context.source);
            return (sourceModifiers[kind] || []).reduce(function (current, modifier) {
                if (modifier.sources && modifier.sources.indexOf(context.source) < 0) return current;
                try { return modifier.run(current, context); } catch (e) { warn('來源倍率 ' + modifier.id, e); return current; }
            }, value);
        }
        registerSource('player', { matches:function (actor) { try { return actor && actor === player; } catch (e) { return false; } } });
        registerSource('mercenary', { matches:function (actor) { return !!(actor && (actor._allyName || actor._slot)); } });
        registerSource('pet', { matches:function (actor) { return !!(actor && actor.uid && actor.form && Object.prototype.hasOwnProperty.call(actor, 'outSlot')); } });
        registerSource('summon', { matches:function (actor) { return !!(actor && (actor.skId || actor.kind) && actor.form && !Object.prototype.hasOwnProperty.call(actor, 'outSlot')); } });

        return {
            schedule:schedule, cancel:cancel, when:when, every:every, stopEvery:stopEvery,
            hooks:{ intercept:intercept, after:after, original:original },
            layers:{ open:openLayer, close:closeLayer, position:function (id) { var index = layerIndex(id); if (index >= 0) positionLayer(layerStack[index]); }, top:topLayer, tooltips:manageTooltips },
            sources:{ register:registerSource, resolve:resolveSource, with:withSource, modifier:registerModifier, modify:modify, current:function () { return sourceStack.length ? sourceStack[sourceStack.length - 1] : null; } }
        };
    }

    // ============================================================
    //  🧾 統一物品懸停資訊與完整物品視窗
    // ============================================================
    function initItemInfoPreviewModule() {
        var tip = null, activeHost = null, activeItem = null, closeTimer = 0;
        var SLOT_KEYS = ['wpn','shield','helm','armor','tshirt','cloak','gloves','shin','boots','amulet','ear1','ear2','ring1','ring2','ring3','ring4','belt','pet','doll','arrow'];

        function esc(value) {
            return String(value == null ? '' : value).replace(/[&<>\"]/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; });
        }
        function findInventory(uidValue) {
            if (typeof player === 'undefined' || !player) return null;
            return (player.inv || []).find(function (item) { return item && String(item.uid) === String(uidValue); }) || null;
        }
        function findEquipped(uidValue) {
            if (typeof player === 'undefined' || !player || !player.eq) return null;
            for (var slot in player.eq) {
                var item = player.eq[slot];
                if (item && String(item.uid) === String(uidValue)) return item;
            }
            return null;
        }
        function findPet(uidValue) {
            try { if (typeof _petFind === 'function') return _petFind(uidValue); } catch (e) {}
            try {
                if (typeof petRoster === 'function') return petRoster().find(function (pet) { return pet && String(pet.uid) === String(uidValue); }) || null;
            } catch (e) {}
            return null;
        }
        function plainInstance(id) { return id ? { id:String(id), uid:'afk-tip-' + id, cnt:1, en:0, bless:false, anc:false, attr:false, lock:false } : null; }
        function resolveHost(target) {
            if (!target || !target.closest) return null;
            return target.closest(
                '.afk-virtual-rows .list-item[data-uid],' +
                '#tab-equip .list-item[data-afk-equip-tip],' +
                '#equipment-window [data-tip-uid],' +
                '#relic-book [data-tip-id],' +
                '#pet-gear-overlay [data-tip-uid],' +
                '#pet-gear-overlay [data-afk-pet-owner],' +
                '[data-afk-squad-act="pet-gear"],' +
                '[data-afk-pet-owner][data-afk-pet-slot]'
            );
        }
        function resolveItem(host) {
            if (!host) return null;
            var owner = host.dataset.afkPetOwner || (host.dataset.afkSquadAct === 'pet-gear' ? host.dataset.uid : '');
            var petSlot = host.dataset.afkPetSlot || (host.dataset.afkSquadAct === 'pet-gear' ? host.dataset.slot : '');
            if (owner && petSlot) {
                var pet = findPet(owner);
                return pet && pet.eq ? pet.eq[petSlot] || null : null;
            }
            var uidValue = host.dataset.tipUid || host.dataset.uid;
            if (uidValue) {
                if (host.dataset.tipSrc === 'eq' || host.dataset.afkEquipTip === '1') return findEquipped(uidValue);
                return findInventory(uidValue) || findEquipped(uidValue);
            }
            return host.dataset.tipId ? plainInstance(host.dataset.tipId) : null;
        }
        function compactBody(item) {
            var html = '';
            try { if (typeof buildItemDescHTML === 'function') html = buildItemDescHTML(item) || ''; } catch (e) {}
            if (!html && typeof DB !== 'undefined' && DB.items && DB.items[item.id]) html = esc(DB.items[item.id].d || '沒有額外說明。');
            html = html.replace(/<br><span class="text-slate-400">適用職業：<\/span>(?:<img[\s\S]*?>)+/g, '');
            html = html.replace(/<br><span class="text-amber-300">重量:[\s\S]*?<\/span>/g, '');
            html = html.replace(/<br><span class="text-slate-400">安定值:[\s\S]*?<\/span>/g, '');
            html = html.replace(/<br><span class="text-yellow-400 mt-2 block">販賣價格:[\s\S]*?<\/span>/g, '');
            return html;
        }
        function ensureTip() {
            if (tip && tip.isConnected) return tip;
            tip = document.createElement('aside');
            tip.id = 'afk-item-preview'; tip.setAttribute('role', 'tooltip'); tip.tabIndex = -1;
            tip.addEventListener('pointerenter', cancelClose);
            tip.addEventListener('pointerleave', queueClose);
            tip.addEventListener('wheel', function (event) {
                if (tip.scrollHeight <= tip.clientHeight) return;
                tip.scrollTop += event.deltaY; event.preventDefault(); event.stopPropagation();
            }, { passive:false });
            document.body.appendChild(tip);
            AFKRuntime.layers.tooltips('#afk-item-preview');
            return tip;
        }
        function renderTip(item) {
            if (!item || typeof DB === 'undefined' || !DB.items || !DB.items[item.id]) return false;
            var def = DB.items[item.id], name = def.n || item.id, icon = '', color = '';
            try { name = typeof getItemFullName === 'function' ? getItemFullName(item) : name; } catch (e) {}
            try { icon = typeof getIconUrl === 'function' ? getIconUrl(def) : (def.img || ''); } catch (e) {}
            try { color = typeof getItemColor === 'function' ? getItemColor(item) : ''; } catch (e) {}
            var badges = [];
            if ((item.cnt || 1) > 1) badges.push('×' + Number(item.cnt || 1).toLocaleString());
            if (item.lock) badges.push('🔒 已鎖定');
            if (def.relic) badges.push('🏺 遺物');
            ensureTip().innerHTML = '<header><img src="' + esc(icon) + '" alt=""><span><b class="' + esc(color) + '">' + name + '</b>' +
                (badges.length ? '<small>' + esc(badges.join('・')) + '</small>' : '') + '</span></header><div class="afk-item-preview-body">' + compactBody(item) + '</div>';
            return true;
        }
        function positionTip(event) {
            if (!tip || tip.hidden || !activeHost) return;
            var margin = 8, gap = 14, rect = tip.getBoundingClientRect();
            var x = event.clientX + gap, y = event.clientY + gap;
            if (x + rect.width > window.innerWidth - margin) x = event.clientX - rect.width - gap;
            if (y + rect.height > window.innerHeight - margin) y = event.clientY - rect.height - gap;
            tip.style.left = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)) + 'px';
            tip.style.top = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)) + 'px';
        }
        function cancelClose() { if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; } }
        function hideTip() {
            cancelClose(); activeHost = null; activeItem = null;
            if (tip) { tip.hidden = true; tip.scrollTop = 0; }
            if (document.body) document.body.classList.remove('afk-item-previewing');
            document.querySelectorAll('body>.game-tooltip').forEach(function (oldTip) { oldTip.style.display = 'none'; });
        }
        function queueClose() { cancelClose(); closeTimer = setTimeout(hideTip, 180); }
        function showTip(host, event) {
            var item = resolveItem(host); if (!item || !renderTip(item)) { hideTip(); return; }
            cancelClose(); activeHost = host; activeItem = item; tip.hidden = false; tip.scrollTop = 0;
            document.body.classList.add('afk-item-previewing'); positionTip(event);
        }
        function equipSlotKeys() {
            var keys = SLOT_KEYS.slice();
            try {
                if (player && player.cls === 'warrior' && ((player.skills || []).indexOf('sk_warrior_dualaxe') >= 0 || (player.eq && player.eq.offwpn))) keys.splice(1, 0, 'offwpn');
                if (typeof SHERINE_REMAINS !== 'undefined') SHERINE_REMAINS.forEach(function (row) { keys.push(row.id); });
            } catch (e) {}
            return keys;
        }
        function decorateEquipTab() {
            var host = document.getElementById('tab-equip');
            if (!host || typeof player === 'undefined' || !player || !player.eq) return;
            var keys = equipSlotKeys(), rows = host.querySelectorAll('.list-item');
            Array.prototype.forEach.call(rows, function (row, index) {
                var item = player.eq[keys[index]];
                if (!item || item.uid == null) { delete row.dataset.afkEquipTip; delete row.dataset.tipUid; return; }
                row.dataset.afkEquipTip = '1'; row.dataset.tipUid = String(item.uid); row.dataset.tipSrc = 'eq'; row.dataset.tipId = String(item.id);
            });
        }
        function decoratePetStorage() {
            document.querySelectorAll('button[onclick^="petGearOpen("]').forEach(function (button) {
                var code = button.getAttribute('onclick') || '';
                var found = code.match(/petGearOpen\('([^']+)'\s*,\s*'(wpn|arm)'\)/);
                if (!found) return;
                button.dataset.afkPetOwner = found[1]; button.dataset.afkPetSlot = found[2];
            });
        }
        function decoratePetOverlay() {
            var overlay = document.getElementById('pet-gear-overlay'); if (!overlay) return;
            overlay.querySelectorAll('button[onclick^="petGearEquip("]').forEach(function (button) {
                var code = button.getAttribute('onclick') || '';
                var found = code.match(/petGearEquip\('([^']+)'\s*,\s*'(wpn|arm)'\s*,\s*'([^']+)'\)/);
                if (!found) return;
                button.dataset.tipUid = found[3]; button.dataset.tipSrc = 'inv'; button.dataset.tipId = (findInventory(found[3]) || {}).id || '';
            });
            overlay.querySelectorAll('button[onclick^="petGearUnequip("]').forEach(function (button) {
                var code = button.getAttribute('onclick') || '';
                var found = code.match(/petGearUnequip\('([^']+)'\s*,\s*'(wpn|arm)'\)/);
                if (!found) return;
                button.dataset.afkPetOwner = found[1]; button.dataset.afkPetSlot = found[2];
            });
        }
        function decorateAll() { decorateEquipTab(); decoratePetStorage(); decoratePetOverlay(); }
        function syncRelicModal(result, args) {
            var modal = document.getElementById('item-modal'), item = args && args[0], def = item && typeof DB !== 'undefined' && DB.items ? DB.items[item.id] : null;
            if (modal) modal.classList.toggle('afk-relic-detail', !!(def && def.relic));
        }

        document.addEventListener('pointerover', function (event) {
            if (tip && tip.contains(event.target)) { cancelClose(); return; }
            var host = resolveHost(event.target); if (!host) return;
            if (host === activeHost) { cancelClose(); return; }
            showTip(host, event);
        }, true);
        document.addEventListener('pointermove', function (event) {
            if (activeHost && (activeHost.contains(event.target) || (tip && tip.contains(event.target)))) positionTip(event);
        }, { passive:true, capture:true });
        document.addEventListener('pointerout', function (event) {
            if (!activeHost) return;
            var related = event.relatedTarget;
            if ((related && activeHost.contains(related)) || (tip && related && tip.contains(related))) return;
            if (activeHost.contains(event.target)) queueClose();
        }, true);
        document.addEventListener('wheel', function (event) {
            if (!activeHost || !activeHost.contains(event.target) || !tip || tip.scrollHeight <= tip.clientHeight) return;
            tip.scrollTop += event.deltaY; event.preventDefault(); event.stopPropagation();
        }, { passive:false, capture:true });
        window.addEventListener('blur', hideTip);
        var style = document.createElement('style'); style.id = 'afk-item-info-style';
        style.textContent =
            'body.afk-item-previewing> .game-tooltip{display:none!important}' +
            '#afk-item-preview{position:fixed;z-index:2147483647;box-sizing:border-box;width:min(360px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow-y:auto;padding:10px 12px;border:1px solid #64748b;border-radius:10px;background:rgba(15,23,42,.985);color:#cbd5e1;box-shadow:0 14px 38px rgba(0,0,0,.82);font:12px/1.5 system-ui,sans-serif;overscroll-behavior:contain}' +
            '#afk-item-preview[hidden]{display:none!important}#afk-item-preview header{position:sticky;top:-10px;z-index:1;display:flex;align-items:center;gap:9px;margin:-2px -2px 7px;padding:2px 2px 7px;border-bottom:1px solid #334155;background:rgba(15,23,42,.985)}' +
            '#afk-item-preview header img{width:34px;height:34px;flex:none;object-fit:contain}#afk-item-preview header span{min-width:0;display:flex;flex-direction:column}#afk-item-preview header b{font-size:14px;overflow-wrap:anywhere}#afk-item-preview header small{color:#94a3b8;font-size:9px}.afk-item-preview-body{overflow-wrap:anywhere}' +
            '#item-modal{position:fixed!important;inset:auto!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;box-sizing:border-box!important;max-width:calc(100vw - 24px)!important;max-height:calc(100vh - 24px)!important;align-items:flex-start!important}' +
            '#item-modal>div{box-sizing:border-box!important;max-height:calc(100vh - 24px)!important;overflow-y:auto!important;overscroll-behavior:contain}' +
            '@media(max-width:760px){#item-modal{width:calc(100vw - 16px)!important;max-width:none!important;max-height:calc(100vh - 16px)!important;flex-direction:column!important;align-items:stretch!important;overflow-y:auto!important;gap:8px!important}#item-modal>div{width:100%!important;min-width:0!important;max-width:none!important;max-height:none!important;overflow:visible!important}#item-modal>div:not(#modal-compare){order:1}#item-modal>#modal-compare{order:2}}';
        document.head.appendChild(style);

        AFKRuntime.hooks.after('renderTabs', 'item-tip-equip-tab', decorateAll);
        AFKRuntime.hooks.after('renderPetStorageNPC', 'item-tip-pet-storage', decoratePetStorage);
        AFKRuntime.hooks.after('petGearOpen', 'item-tip-pet-overlay', decoratePetOverlay);
        AFKRuntime.hooks.after('renderSquadPanel', 'item-tip-squad', decorateAll);
        AFKRuntime.hooks.intercept('openModal', 'item-tip-relic-modal', function (next, self, args) {
            var result = next.apply(null, args); syncRelicModal(result, args); return result;
        });
        AFKRuntime.hooks.after('closeModal', 'item-tip-relic-close', function () { var modal = document.getElementById('item-modal'); if (modal) modal.classList.remove('afk-relic-detail'); }, { frame:false });
        AFKRuntime.when('item-tip:ready', function () { return document.body && typeof window.buildItemDescHTML === 'function'; }, function () { ensureTip().hidden = true; decorateAll(); });
    }

    // ============================================================
    //  ⚡ 加速器（v3.17.0：三種流暢度模式；最高 50000× 目標倍率）
    // ============================================================
    function initSpeedModule() {
        var LS = function (k) { return 'afk_speed_' + k; };
        var MAX_SPEED = 50000, TICK_MS = 100;
        var PROFILES = {
            smooth: { label: '嚴格流暢', budget: 6, maxBatch: 48, maxCalls: 2, initial: 4, renderEvery: 34, creditMult: 4 },
            balanced: { label: '平衡', budget: 8, maxBatch: 96, maxCalls: 3, initial: 8, renderEvery: 42, creditMult: 4 },
            throughput: { label: '吞吐優先', budget: 12, maxBatch: 192, maxCalls: 4, initial: 12, renderEvery: 67, creditMult: 4 }
        };
        var profileKey = localStorage.getItem(LS('profile')) || 'smooth';
        if (!PROFILES[profileKey]) profileKey = 'smooth';
        var gearEnabled = localStorage.getItem(LS('enabled')) !== 'false';
        var speedRate = Math.max(0.1, Math.min(MAX_SPEED, Number(localStorage.getItem(LS('speed'))) || 1));
        var savedSpeed = speedRate > 1 ? speedRate : 5;
        var panelOpen = false;
        var activeTab = 'speed';
        var hotkey = localStorage.getItem(LS('hk')) || 'F6';
        var hooked = false;
        var hEl, pEl, cEl, recKey = false;
        var _lastRenderTabs = 0;
        var _renderThrottleMs = 250;
        var _fastRenderThrottleMs = 800;
        var _adaptiveTicks = PROFILES[profileKey].initial;
        var _costPerTick = 0.25;
        var _cooldownUntil = 0;
        var _lastBatchTicks = 1;
        var _slowestBatchMs = 0;
        var _batchWindowMaxMs = 0;
        var _lastLongTaskMs = 0;
        var _lastAdaptiveUi = 0;
        var _pumpRaf = 0;
        var _pumpLast = 0;
        var _pumpWasRunning = false;
        var _tickCredit = 0;
        var _extraTicksWindow = 0;
        var _rateWindowStarted = 0;
        var _actualRate = 1;
        var _speedLimited = false;
        var _speedSliceActive = false;
        var _speedFlushPass = false;
        var _renderPending = { ui: false, mobs: false, tabs: false, forceTabs: false };
        var _lastSpeedRender = 0;
        var _origUpdateUI = null, _origRenderMobs = null, _origRenderTabs = null;
        var _longTaskObserver = null;

        function clockNow() {
            return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        }

        function resetPump(now) {
            _pumpLast = now || clockNow();
            _tickCredit = 0;
            _speedLimited = false;
            _adaptiveTicks = PROFILES[profileKey].initial;
            _costPerTick = 0.25;
            _cooldownUntil = 0;
            _extraTicksWindow = 0;
            _rateWindowStarted = _pumpLast;
            _actualRate = 1;
            _lastBatchTicks = 0;
            _slowestBatchMs = 0;
            _batchWindowMaxMs = 0;
            _lastLongTaskMs = 0;
        }

        function updateMeasuredRate(now) {
            if (!_rateWindowStarted) _rateWindowStarted = now;
            var elapsed = now - _rateWindowStarted;
            if (elapsed < 1000) return;
            _actualRate = gearEnabled && speedRate > 1
                ? 1 + (_extraTicksWindow * TICK_MS / elapsed)
                : 1;
            _extraTicksWindow = 0;
            _rateWindowStarted = now;
            _slowestBatchMs = _batchWindowMaxMs;
            _batchWindowMaxMs = 0;
        }

        function currentProfile() { return PROFILES[profileKey]; }

        function inputPending() {
            try { return !!(navigator.scheduling && navigator.scheduling.isInputPending && navigator.scheduling.isInputPending()); }
            catch (e) { return false; }
        }

        function tuneBatch(batch, spent, now) {
            var p = currentProfile();
            var sample = Math.max(0.001, spent / Math.max(1, batch));
            _batchWindowMaxMs = Math.max(_batchWindowMaxMs, spent);
            _costPerTick = sample > _costPerTick ? sample : (_costPerTick * 0.94 + sample * 0.06);
            if (spent >= 50 || spent > p.budget * 1.5) {
                _adaptiveTicks = Math.max(1, Math.floor(Math.min(batch, _adaptiveTicks) * 0.35));
                _cooldownUntil = now + 1500;
                _speedLimited = true;
            } else if (spent > p.budget / Math.max(1, p.maxCalls) * 1.25) {
                _adaptiveTicks = Math.max(1, Math.floor(Math.min(batch, _adaptiveTicks) * 0.7));
                _cooldownUntil = now + 500;
            } else if (now >= _cooldownUntil && spent < p.budget / Math.max(1, p.maxCalls) * 0.75) {
                _adaptiveTicks = Math.min(p.maxBatch, _adaptiveTicks + Math.max(1, Math.ceil(_adaptiveTicks * 0.08)));
            }
        }

        function initLongTaskObserver() {
            if (_longTaskObserver || typeof PerformanceObserver !== 'function') return;
            try {
                _longTaskObserver = new PerformanceObserver(function (list) {
                    list.getEntries().forEach(function (entry) {
                        if (!entry || entry.duration < 50 || !gearEnabled || speedRate <= 1) return;
                        _lastLongTaskMs = Math.max(_lastLongTaskMs, entry.duration);
                        _adaptiveTicks = Math.max(1, Math.floor(_adaptiveTicks * 0.35));
                        _cooldownUntil = clockNow() + 1800;
                        _speedLimited = true;
                    });
                });
                _longTaskObserver.observe({ type: 'longtask', buffered: false });
            } catch (e) { _longTaskObserver = null; }
        }

        function speedPump(now) {
            _pumpRaf = requestAnimationFrame(speedPump);
            if (!_pumpLast) resetPump(now);
            var elapsed = Math.max(0, Math.min(100, now - _pumpLast));
            _pumpLast = now;
            var canRun = typeof state !== 'undefined' && state && state.running &&
                typeof player !== 'undefined' && player && !player.dead &&
                typeof window.gameLoop === 'function' && typeof _tickDebt !== 'undefined';
            if (!gearEnabled || speedRate <= 1 || !canRun) {
                flushSpeedRenders(now, true);
                if (_pumpWasRunning || _tickCredit || _actualRate !== 1) resetPump(now);
                _pumpWasRunning = false;
                updateMeasuredRate(now);
                return;
            }
            _pumpWasRunning = true;

            var profile = currentProfile();
            var added = (elapsed / TICK_MS) * (speedRate - 1);
            var creditCap = Math.max(8, profile.maxBatch * profile.creditMult);
            _tickCredit = Math.min(creditCap, _tickCredit + added);
            _speedLimited = _tickCredit >= creditCap - 0.001;
            var frameStarted = clockNow();
            var ran = 0, calls = 0;

            while (_tickCredit >= 1 && calls < profile.maxCalls) {
                var frameSpent = clockNow() - frameStarted;
                var remaining = profile.budget - frameSpent;
                if (remaining <= 0.25 || inputPending()) { _speedLimited = true; break; }
                var predicted = Math.max(1, Math.floor((remaining * 0.82) / Math.max(0.001, _costPerTick)));
                var batch = Math.max(1, Math.min(Math.floor(_tickCredit), _adaptiveTicks, profile.maxBatch, predicted));
                var before = clockNow();
                _speedSliceActive = true;
                window.__afkSpeedSlice = true;
                try {
                    _tickDebt += batch * TICK_MS;
                    window.gameLoop();
                } finally {
                    _speedSliceActive = false;
                    window.__afkSpeedSlice = false;
                }
                var spent = clockNow() - before;
                _tickCredit = Math.max(0, _tickCredit - batch);
                _extraTicksWindow += batch;
                ran += batch;
                calls++;
                _lastBatchTicks = batch;
                tuneBatch(batch, spent, now);
                if (!state.running || player.dead) { _tickCredit = 0; break; }
            }
            if (_tickCredit >= 1) _speedLimited = true;
            if (!ran) _lastBatchTicks = 0;
            flushSpeedRenders(now, false);
            updateMeasuredRate(now);
            var uiNow = Date.now();
            if (panelOpen && uiNow - _lastAdaptiveUi >= 500) {
                _lastAdaptiveUi = uiNow;
                updateAdaptiveStatus();
            }
        }

        function tryHook() {
            if (hooked) return;
            if (typeof window.gameLoop !== 'function') return;
            if (window.__afkSpV317) { hooked = true; return; }
            window.__afkSpV317 = true;
            hooked = true;
            resetPump(clockNow());
            initLongTaskObserver();
            if (!_pumpRaf && typeof requestAnimationFrame === 'function') _pumpRaf = requestAnimationFrame(speedPump);
        }

        function visibleBagTab() {
            return document.querySelector('#tab-weapons:not(.hidden),#tab-armors:not(.hidden),#tab-items:not(.hidden)');
        }

        function flushSpeedRenders(now, forceNow) {
            var p = currentProfile();
            var sceneWatchdog = gearEnabled && speedRate > 1 && _pumpWasRunning && now - _lastSpeedRender >= Math.max(100, p.renderEvery);
            if (!_renderPending.ui && !_renderPending.mobs && !_renderPending.tabs && !sceneWatchdog) return;
            if (!forceNow && now - _lastSpeedRender < p.renderEvery) return;
            _lastSpeedRender = now;
            var doUi = _renderPending.ui, doMobs = _renderPending.mobs || sceneWatchdog;
            var doTabs = _renderPending.tabs, forceTabs = _renderPending.forceTabs;
            _renderPending.ui = _renderPending.mobs = _renderPending.tabs = _renderPending.forceTabs = false;
            if (doUi && _origUpdateUI) { _speedFlushPass = true; try { window.updateUI(); } finally { _speedFlushPass = false; } }
            if (doMobs && _origRenderMobs) { _speedFlushPass = true; try { window.renderMobs(); } finally { _speedFlushPass = false; } }
            if (doTabs && _origRenderTabs) {
                var bagTab = visibleBagTab();
                var equipWindow = document.getElementById('equipment-window');
                var equipWindowOpen = !!(equipWindow && !equipWindow.classList.contains('hidden'));
                if (bagTab && !forceTabs && !equipWindowOpen && typeof window.__afkVirtualDirtyCurrent === 'function') window.__afkVirtualDirtyCurrent();
                else {
                    window.__afkRenderTabsForce = !!forceTabs;
                    _speedFlushPass = true;
                    try { window.renderTabs(!!forceTabs); }
                    finally { _speedFlushPass = false; window.__afkRenderTabsForce = false; }
                }
            }
        }

        function patchRenderTabs() {
            if (window.__afkSpRenderV4) return;
            _origRenderTabs = AFKRuntime.hooks.original('renderTabs');
            _origUpdateUI = AFKRuntime.hooks.original('updateUI');
            _origRenderMobs = AFKRuntime.hooks.original('renderMobs');
            AFKRuntime.hooks.intercept('updateUI', 'speed-render', function (next, self, args) {
                if (_speedFlushPass) return next.apply(null, args);
                if (_speedSliceActive) { _renderPending.ui = true; return; }
                _renderPending.ui = false;
                return next.apply(null, args);
            });
            AFKRuntime.hooks.intercept('renderMobs', 'speed-render', function (next, self, args) {
                if (_speedFlushPass) return next.apply(null, args);
                if (_speedSliceActive) { _renderPending.mobs = true; return; }
                _renderPending.mobs = false;
                return next.apply(null, args);
            });
            AFKRuntime.hooks.intercept('renderTabs', 'speed-render', function (next, self, args) {
                if (_speedFlushPass) return next.apply(null, args);
                var now = Date.now();
                var throttle = speedRate > 5 ? _fastRenderThrottleMs : _renderThrottleMs;
                var force = args[0] === true;
                var inTick = typeof state !== 'undefined' && state && state.inTick;
                var bagTab = visibleBagTab();
                var equipWindow = document.getElementById('equipment-window');
                var equipWindowOpen = !!(equipWindow && !equipWindow.classList.contains('hidden'));
                if (force && window.__afkSuppressSortRender) return;
                if (_speedSliceActive) {
                    _renderPending.tabs = true;
                    if (force) _renderPending.forceTabs = true;
                    return;
                }
                _renderPending.tabs = false;
                _renderPending.forceTabs = false;
                // 戰鬥掉落熱路徑只通知虛擬背包，避免原始 renderTabs 每 250ms 再掃一次完整背包。
                if (!force && inTick && bagTab && !equipWindowOpen && typeof window.__afkVirtualDirtyCurrent === 'function') {
                    window.__afkVirtualDirtyCurrent();
                    return;
                }
                var tickThrottle = (bagTab || equipWindowOpen) ? 1500 : _renderThrottleMs;
                if (!force && inTick && now - _lastRenderTabs < tickThrottle) return;
                if (!force && speedRate > 50) {
                    if (!bagTab && now - _lastRenderTabs < throttle) return;
                }
                _lastRenderTabs = now;
                window.__afkRenderTabsForce = force;
                try { return next.apply(null, args); }
                finally { window.__afkRenderTabsForce = false; }
            });
            window.__afkSpRenderV4 = true;
        }

        function s2s(s) {
            if (s <= 1) return s * 10;
            if (s <= 10) return 10 + ((s-1)/9)*20;
            if (s <= 100) return 30 + ((s-10)/90)*25;
            if (s <= 1000) return 55 + (Math.log10(s)-2)*20;
            return 75 + ((Math.log10(s)-3)/(Math.log10(MAX_SPEED)-3))*25;
        }
        function sl2s(v) {
            var s = Number(v);
            if (s <= 10) return s/10;
            if (s <= 30) return 1+((s-10)/20)*9;
            if (s <= 55) return 10+((s-30)/25)*90;
            if (s <= 75) return Math.pow(10, 2+((s-55)/20));
            return Math.pow(10, 3+((s-75)/25)*(Math.log10(MAX_SPEED)-3));
        }

        function applySp(v, p) { speedRate = Math.max(0.1, Math.min(MAX_SPEED, Number(v))); gearEnabled = true; if (speedRate > 1) savedSpeed = speedRate; resetPump(clockNow()); if (p !== false) { localStorage.setItem(LS('speed'), String(speedRate)); localStorage.setItem(LS('enabled'), 'true'); } sync(); }
        function setProfile(key) {
            if (!PROFILES[key] || key === profileKey) return;
            flushSpeedRenders(clockNow(), true);
            profileKey = key;
            localStorage.setItem(LS('profile'), profileKey);
            resetPump(clockNow());
            sync();
        }
        function toggleG() {
            gearEnabled = !gearEnabled;
            flushSpeedRenders(clockNow(), true);
            resetPump(clockNow());
            if (gearEnabled) {
                speedRate = savedSpeed > 1 ? savedSpeed : 5;
                localStorage.setItem(LS('enabled'), 'true');
                tryHook();
            } else localStorage.setItem(LS('enabled'), 'false');
            sync();
        }

        function togglePanel() { panelOpen = !panelOpen; if (panelOpen) { showP(); } else { hideP(); } }

        // v3.11.0 起由「自動保命」統一排程，避免瞬移／回村與復活各自輪詢。

        function positionPanel() {
            if (!pEl || !hEl || !panelOpen) return;
            AFKRuntime.layers.position('speed-settings');
        }
        function showP() {
            if (!pEl) return;
            pEl.classList.add('visible');
            AFKRuntime.layers.open('speed-settings', { element:pEl, anchor:hEl, triggers:[hEl], gap:10, onClose:function () { panelOpen = false; pEl.classList.remove('visible'); } });
            AFKRuntime.schedule('speed:panel-position', positionPanel);
        }
        function hideP() { if (pEl) pEl.classList.remove('visible'); AFKRuntime.layers.close('speed-settings', 'button'); }

        function rTab() {
            if (!cEl) return;
            Array.from(pEl.querySelectorAll('.as-tb')).forEach(function (b) { b.classList.toggle('active', b.dataset.tab === activeTab); });
            if (activeTab === 'speed') {
                cEl.innerHTML = '<div class="as-cnt"><div class="as-sec"><div class="as-st">⚡ 核心變速 <span id="as-sts" class="as-pl"></span></div><div class="as-r"><span class="as-lb">開關</span><button id="as-tog" class="as-bt"></button></div><div class="as-r"><span class="as-lb">目標倍率</span><input id="as-spd" type="number" min="0.1" max="' + MAX_SPEED + '" step="0.1" class="as-ip"></div><input id="as-sld" type="range" min="0" max="100" step="0.1" class="as-sl"><div class="as-g3"><button class="as-bt" data-s="2">2×</button><button class="as-bt" data-s="5">5×</button><button class="as-bt" data-s="10">10×</button><button class="as-bt" data-s="50">50×</button><button class="as-bt" data-s="100">100×</button><button class="as-bt as-wn" data-s="1000">1000×</button></div><div class="as-g3"><button class="as-bt" data-s="5000">5000×</button><button class="as-bt" data-s="10000">10000×</button><button class="as-bt as-wn" data-s="50000">50000×</button></div><div class="as-st as-prof-title">效能模式</div><div class="as-profile-grid"><button class="as-bt" data-profile="smooth">嚴格流暢</button><button class="as-bt" data-profile="balanced">平衡</button><button class="as-bt" data-profile="throughput">吞吐優先</button></div><div id="as-adaptive" class="as-ht"></div><div class="as-ht">💡 50000× 是目標倍率；超過裝置能力時會丟棄過舊額度，不阻塞操作。</div></div></div>';
            } else {
                cEl.innerHTML = '<div class="as-cnt"><div class="as-sec"><div class="as-st">⌨️ 熱鍵</div><div class="as-r"><span class="as-lb">切換加速</span><button id="as-hk" class="as-bt"></button></div><div class="as-ht">目前熱鍵：<b>' + hotkey + '</b>（點上方按鈕重新設定）</div></div><div class="as-sec"><div class="as-st">ℹ️ 關於</div><div class="as-ht">⚡ 一鍵外掛 v3.29.5<br>使用說明精簡整理<br>目標最高 50000×，並顯示實際速度</div></div></div>';
            }
            sync();
            if (panelOpen) AFKRuntime.schedule('speed:panel-position', positionPanel);
        }

        function updateAdaptiveStatus() {
            var adaptive = document.getElementById('as-adaptive');
            var p = currentProfile();
            if (adaptive) adaptive.textContent = gearEnabled
                ? '目標 ' + Math.round(speedRate) + '×／實際約 ' + _actualRate.toFixed(_actualRate >= 100 ? 0 : 1) + '×／' + p.label + '／本批 ' + _lastBatchTicks + ' ticks／安全上限 ' + _adaptiveTicks + '/' + p.maxBatch + '／最近最慢 ' + _slowestBatchMs.toFixed(1) + 'ms' + (_lastLongTaskMs >= 50 ? '／Long Task ' + _lastLongTaskMs.toFixed(0) + 'ms' : '') + (_speedLimited ? '（效能限制中）' : '')
                : '實際：1×／加速已暫停';
        }

        function sync() {
            if (!hEl) return;
            hEl.textContent = gearEnabled ? '⚡' : '⏸'; hEl.classList.toggle('off', !gearEnabled);
            if (activeTab === 'speed') {
                var tog = document.getElementById('as-tog'), sts = document.getElementById('as-sts'), inp = document.getElementById('as-spd'), sl = document.getElementById('as-sld');
                if (tog) { tog.textContent = gearEnabled ? '已開啟' : '已關閉'; tog.className = 'as-bt afk-ui-toggle' + (gearEnabled ? ' active' : ''); tog.setAttribute('aria-pressed', gearEnabled ? 'true' : 'false'); }
                if (sts) sts.textContent = gearEnabled ? Math.round(speedRate) + '×' : 'OFF';
                if (inp && document.activeElement !== inp) inp.value = speedRate >= 100 ? String(Math.round(speedRate)) : speedRate.toFixed(1);
                if (sl && document.activeElement !== sl) sl.value = String(s2s(speedRate));
                if (cEl) Array.from(cEl.querySelectorAll('[data-s]')).forEach(function (b) { b.classList.toggle('active', gearEnabled && Math.round(speedRate) === Number(b.dataset.s)); });
                if (cEl) Array.from(cEl.querySelectorAll('[data-profile]')).forEach(function (b) { b.classList.toggle('active', b.dataset.profile === profileKey); });
                updateAdaptiveStatus();
            }
            if (activeTab === 'hotkey') {
                var hk = document.getElementById('as-hk');
                if (hk) hk.textContent = recKey ? '按下按鍵…' : hotkey;
            }
        }

        function initUI() {
            hEl = document.createElement('div'); hEl.id = 'as-h'; hEl.style.setProperty('--as-hs', '40px');
            // 將加速器按鈕放到戰場左下角；戰場隱藏時按鈕會自然一併隱藏。
            var _battle = document.getElementById('battle-view') || document.getElementById('map-view-panel') || document.body;
            _battle.appendChild(hEl);
            pEl = document.createElement('div'); pEl.id = 'as-p';
            document.body.appendChild(pEl);
            pEl.innerHTML = '<div class="as-hd"><span class="as-tl">⚡ 加速器</span><button id="as-pb" title="關閉">✕</button></div><div class="as-ts"><button class="as-tb as-tb-sp" data-tab="speed">⚡ 變速</button><button class="as-tb as-tb-hk" data-tab="hotkey">⌨️ 熱鍵</button></div><div id="as-ct"></div>';
            cEl = document.getElementById('as-ct');

            // 點擊齒輪 toggle 面板
            hEl.addEventListener('click', function (e) { e.stopPropagation(); togglePanel(); });
            // 關閉鈕
            document.getElementById('as-pb').addEventListener('click', function () { panelOpen = false; hideP(); });

            Array.from(pEl.querySelectorAll('.as-tb')).forEach(function (b) { b.addEventListener('click', function () { activeTab = b.dataset.tab; rTab(); }); });
            cEl.addEventListener('click', function (e) {
                var btn = e.target.closest('button'); if (!btn) return;
                if (btn.dataset.profile) { setProfile(btn.dataset.profile); return; }
                if (btn.dataset.s) { applySp(Number(btn.dataset.s)); return; }
                if (btn.id === 'as-tog') { toggleG(); return; }
                if (btn.id === 'as-hk') { recKey = true; btn.textContent = '按下按鍵…'; btn.style.borderColor = '#ef4444'; btn.style.color = '#ef4444'; }
            });
            cEl.addEventListener('input', function (e) {
                var el = e.target;
                if (el.id === 'as-sld') { speedRate = Math.max(0.1, Math.min(MAX_SPEED, sl2s(el.value))); gearEnabled = true; sync(); }
            });
            cEl.addEventListener('change', function (e) {
                var el = e.target, id = el.id;
                if (id === 'as-sld' || id === 'as-spd') { applySp(id === 'as-sld' ? sl2s(el.value) : el.value, true); }
                sync();
            });
            rTab();
            sync();
        }

        window.addEventListener('keydown', function (e) {
            if (recKey) { var k = e.key; e.preventDefault(); e.stopPropagation(); if (!k || ['Control','Shift','Alt','Meta'].includes(k)) return; hotkey = k.length === 1 ? k.toUpperCase() : k; localStorage.setItem(LS('hk'), hotkey); recKey = false; rTab(); return; }
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target && e.target.isContentEditable)) return;
            if (e.key === hotkey || e.key === hotkey.toLowerCase()) { e.preventDefault(); toggleG(); }
        }, true);

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) flushSpeedRenders(clockNow(), true);
            resetPump(clockNow());
        });
        window.addEventListener('pagehide', function () {
            flushSpeedRenders(clockNow(), true);
            resetPump(clockNow());
        });

        AFKRuntime.when('speed:ui', function () { return document.body; }, function () { initUI(); });
        AFKRuntime.when('speed:render-hooks', function () { return typeof window.renderTabs === 'function' && typeof window.updateUI === 'function' && typeof window.renderMobs === 'function'; }, patchRenderTabs);
        AFKRuntime.when('speed:game-loop', function () { return typeof window.gameLoop === 'function'; }, tryHook);
    }

    // ============================================================
    //  🚀 大型背包虛擬捲動與完整分類
    // ============================================================
    function initVirtualInventoryModule() {
        var LS = function (k) { return 'afk_isearch_' + k; };
        var ROW_ESTIMATE = 38, MIN_PAGE_SIZE = 6, MAX_PAGE_SIZE = 14;
        var MIN_REBUILD_GAP = 1500, INTERACTION_IDLE = 420;
        var TABS = [
            { k: 'wpn', id: 'tab-weapons', accepts: function (d) { return d.type === 'wpn'; } },
            { k: 'arm', id: 'tab-armors', accepts: function (d) { return d.type === 'arm' || d.type === 'acc'; } },
            { k: 'item', id: 'tab-items', accepts: function (d) { return d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc'; } }
        ];
        var ATTRS = [
            { v: '', l: '✨ 全部屬性' },
            { v: 'bless', l: '✨ 祝福', t: function (m) { return m.item && m.item.bless === true; } },
            { v: 'curse', l: '💀 詛咒', t: function (m) { return m.item && m.item.bless === 'cursed'; } },
            { v: 'legend', l: '👑 傳說', t: function (m) { return m.def && m.def.legend === true; } },
            { v: 'ancient', l: '🏛️ 遠古', t: function (m) { return m.item && m.item.anc && m.item.anc !== false; } },
            { v: 'ench5', l: '⬆️ +5↑', t: function (m) { return m.item && (m.item.en || 0) >= 5; } },
            { v: 'relic', l: '🏺 遺物', t: function (m) { return m.def && m.def.relic === true; } }
        ];
        var WPN_FAMILIES = [
            { v: '', l: '🗡️ 全部武器' },
            { v: 'dagger', l: '🗡️ 匕首' }, { v: 'sword1', l: '⚔️ 單手劍' }, { v: 'sword2', l: '⚔️ 雙手劍' },
            { v: 'katana', l: '🥷 武士刀' }, { v: 'blunt1', l: '🔨 單手鈍器／棍' }, { v: 'blunt2', l: '🔨 雙手鈍器／棍' },
            { v: 'spear', l: '🔱 矛／長柄' }, { v: 'claw', l: '🐾 鋼爪' }, { v: 'dual', l: '⚔️ 雙刀' },
            { v: 'chainsword', l: '⛓️ 鎖鏈劍' }, { v: 'bow', l: '🏹 弓' }, { v: 'xbow', l: '🎯 十字弓' },
            { v: 'wand', l: '🪄 魔杖／法杖' }, { v: 'qigu', l: '🔮 奇古獸' }, { v: 'arrow', l: '🏹 箭矢' },
            { v: 'wpn_other', l: '❓ 其他武器' }
        ];
        var WPN_TRAITS = [
            { v: 'trait_1h', l: '🗡️ 單手', t: function (m) { return !isTwoHand(m.def) && !isRanged(m.def); } },
            { v: 'trait_2h', l: '⚔️ 雙手', t: function (m) { return isTwoHand(m.def) && !isRanged(m.def); } },
            { v: 'trait_combo', l: '⚡ 連擊', t: function (m) { return m.def.eff === 'combo'; } },
            { v: 'trait_crush', l: '💥 粉碎', t: function (m) { return m.def.eff === 'crush'; } },
            { v: 'trait_magic', l: '✨ 魔法效果', t: function (m) { return /^(magicstrike|magicburst|mp_drain|dice_death)$/.test(m.def.eff || '') || !!m.def.spellProc; } }
        ];
        var ARM_CATS = [
            { v: '', l: '🛡️ 全部防具' }, { v: 'helm', l: '🪖 頭盔' }, { v: 'armor', l: '🥋 盔甲' },
            { v: 'shin', l: '🦵 脛甲' }, { v: 'tshirt', l: '👕 內衣' }, { v: 'cloak', l: '🧥 斗篷' },
            { v: 'boots', l: '👢 長靴' }, { v: 'gloves', l: '🧤 手套' }, { v: 'shield', l: '🛡️ 盾牌' },
            { v: 'armguard', l: '💪 臂甲' }, { v: 'amulet', l: '📿 項鍊' }, { v: 'ring', l: '💍 戒指' },
            { v: 'belt', l: '🧷 腰帶' }, { v: 'ear', l: '💠 耳環' }, { v: 'pet', l: '🐾 項圈／寵物裝備' },
            { v: 'doll', l: '🪆 魔法娃娃' }, { v: 'remains', l: '🦴 席琳遺骸' }
        ];
        var ITEM_CATS = [
            { v: '', l: '🎒 全部道具' }, { v: 'scroll', l: '📜 卷軸', t: function (m) { return m.def.type === 'scroll'; } },
            { v: 'skillbk', l: '📖 技能書', t: function (m) { return m.def.type === 'skillbk'; } },
            { v: 'pot', l: '🧪 藥水', t: function (m) { return m.def.type === 'pot'; } },
            { v: 'mat', l: '📦 材料', t: function (m) { return m.def.type === 'etc'; } },
            { v: 'card', l: '🎴 怪物卡片', t: function (m) { return m.def.eff === 'card' || String(m.item.id || '').indexOf('card_') === 0; } },
            { v: 'misc', l: '🎁 其他', t: function (m) { return m.def.type !== 'scroll' && m.def.type !== 'skillbk' && m.def.type !== 'pot' && m.def.type !== 'etc' && m.def.eff !== 'card' && String(m.item.id || '').indexOf('card_') !== 0; } }
        ];
        var states = {};
        TABS.forEach(function (tab) {
            var savedSlot = localStorage.getItem(LS(tab.k + '_slot')) || '';
            if (tab.k === 'wpn') {
                var legacySlot = { '1h': 'trait_1h', '2h': 'trait_2h', combo: 'trait_combo', crush: 'trait_crush', magic: 'trait_magic', other: 'wpn_other' };
                if (legacySlot[savedSlot]) { savedSlot = legacySlot[savedSlot]; localStorage.setItem(LS(tab.k + '_slot'), savedSlot); }
            }
            states[tab.k] = {
                tab: tab, div: null, host: null, rows: [], filtered: [], nodes: new Map(), rowHeight: ROW_ESTIMATE,
                slot: savedSlot,
                attr: tab.k === 'item' ? '' : (localStorage.getItem(LS(tab.k + '_attr')) || ''),
                raf: 0, measureRaf: 0, building: false, stale: true, refreshTimer: 0, headerSig: '',
                headerObserver: null, filterObserver: null, resizeObserver: null, headerObserved: null, filterObserved: null,
                dirtyVersion: 0, buildVersion: 0, lastBuildAt: 0, stagedRows: null, commitTimer: 0,
                interactionUntil: 0, rowHeightReady: false, filterWidth: 0, initialReady: false,
                rowsHost: null, pager: null, page: 0, pageSize: 10, pageCount: 1, filterKey: '',
                selected: new Set(), selectionAnchor: -1, batchBar: null, selectDrag: null
            };
        });
        var metaCache = new WeakMap();
        var sharedIndex = { running: false, requestedVersion: 0, buildVersion: 0, lastBuildAt: 0, timer: 0 };

        function isTwoHand(d) {
            try { if (typeof isTwoHandedWpn === 'function') return !!isTwoHandedWpn(d); } catch (e) {}
            return !!(d && (d.w2h === true || d.w2h === 1));
        }
        function isRanged(d) { return !!(d && (d.ranged === true || d.isBow === true)); }
        function weaponFamily(id, d) {
            if (!d) return 'wpn_other';
            if (d.isArrow) return 'arrow';
            if (d._afkFamilyV311) return d._afkFamilyV311;
            var key = null;
            try { if (typeof equipCatKey === 'function') key = equipCatKey(id, d); } catch (e) {}
            if (!key) {
                var name = String(d.n || '') + ' ' + String(id || '');
                if (d.isBow) key = /十字弓|弩|cross/i.test(name) ? 'xbow' : 'bow';
                else if (d.qigu) key = 'qigu';
                else if (d.chainsword) key = 'chainsword';
                else if (d.isWand || /魔杖|法杖|水晶球|wand|staff/i.test(name)) key = 'wand';
                else if (/鋼爪|指爪|claw/i.test(name)) key = 'claw';
                else if (/雙刀|雙刃|dual/i.test(name)) key = 'dual';
                else if (d.eff === 'pierce' || /矛|長槍|spear/i.test(name)) key = 'spear';
                else if (d.eff === 'crush' || /棍|棒|錘|鎚|斧|club|axe|maul/i.test(name)) key = isTwoHand(d) ? 'blunt2' : 'blunt1';
                else if (/匕首|短刀|dagger/i.test(name)) key = 'dagger';
                else if (/武士刀|katana/i.test(name)) key = 'katana';
                else if (/劍|sword/i.test(name)) key = isTwoHand(d) ? 'sword2' : 'sword1';
                else key = 'wpn_other';
            }
            try { Object.defineProperty(d, '_afkFamilyV311', { value: key, configurable: true }); } catch (e) { d._afkFamilyV311 = key; }
            return key;
        }
        function armorFamily(id, d) {
            if (d && d.remains) return 'remains';
            try { if (typeof equipCatKey === 'function') return equipCatKey(id, d) || d.slot || ''; } catch (e) {}
            if (d.armguard) return 'armguard';
            return d.slot || '';
        }
        function normalize(v) { return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim(); }
        function currentFilterKey(st) {
            var inp = document.getElementById('afk-isearch-' + st.tab.k);
            return normalize(inp ? inp.value : '') + '|' + st.slot + '|' + st.attr;
        }
        function findRule(list, value) {
            for (var i = 0; i < list.length; i++) if (list[i].v === value) return list[i];
            return null;
        }
        function categoryPassValue(tabKey, value, meta) {
            if (!value) return true;
            if (tabKey === 'wpn') {
                if (value.indexOf('trait_') === 0) {
                    var trait = findRule(WPN_TRAITS, value);
                    return !!(trait && trait.t(meta));
                }
                return meta.family === value;
            }
            if (tabKey === 'arm') return meta.family === value;
            var itemRule = findRule(ITEM_CATS, value);
            return !!(itemRule && itemRule.t(meta));
        }
        function categoryPass(st, meta) { return categoryPassValue(st.tab.k, st.slot, meta); }
        function markInteraction(st) {
            if (!st) return;
            st.interactionUntil = Date.now() + INTERACTION_IDLE;
        }
        function filterRows(st, rows) {
            var inp = document.getElementById('afk-isearch-' + st.tab.k);
            var kw = normalize(inp ? inp.value : '');
            var attr = findRule(ATTRS, st.attr);
            return rows.filter(function (meta) {
                if (kw && meta.text.indexOf(kw) < 0) return false;
                if (!categoryPass(st, meta)) return false;
                return !attr || !attr.t || attr.t(meta);
            });
        }
        function applyFilter(st) {
            if (!st.div) return;
            markInteraction(st);
            st.filtered = filterRows(st, st.rows);
            pruneSelection(st);
            pruneQuickJunkSelection(st);
            st.filterKey = currentFilterKey(st);
            st.page = 0;
            ensureHeader(st); renderWindow(st, true);
        }
        function addOptions(select, list, label) {
            var parent = select;
            if (label) { parent = document.createElement('optgroup'); parent.label = label; select.appendChild(parent); }
            list.forEach(function (c) { var o = document.createElement('option'); o.value = c.v; o.textContent = c.l; parent.appendChild(o); });
        }
        function ensureUI(st) {
            var div = st.div;
            var bar = div.querySelector('.afk-isearch,.afk-isearch-plus');
            if (!bar) {
                bar = document.createElement('div'); bar.className = 'afk-isearch-plus'; bar.dataset.afkPersist = '1';
                div.insertBefore(bar, div.firstChild);
            }
            var inp = bar.querySelector('#afk-isearch-' + st.tab.k);
            if (!inp) {
                inp = document.createElement('input'); inp.id = 'afk-isearch-' + st.tab.k; inp.type = 'search'; inp.autocomplete = 'off'; inp.placeholder = '🔍 搜尋名稱…';
                inp.value = localStorage.getItem(LS(st.tab.k + '_name')) || ''; bar.appendChild(inp);
            }
            if (!inp._afkVirtualBound) {
                var storedName = localStorage.getItem(LS(st.tab.k + '_name'));
                if (storedName != null) inp.value = storedName;
            }
            var slot = bar.querySelector('.afk-cs-slot');
            if (!slot) {
                slot = document.createElement('select'); slot.className = 'afk-cs-slot';
                if (st.tab.k === 'wpn') { addOptions(slot, WPN_FAMILIES, '武器種類'); addOptions(slot, WPN_TRAITS, '武器特性'); }
                else addOptions(slot, st.tab.k === 'arm' ? ARM_CATS : ITEM_CATS, '分類');
                slot.value = st.slot; bar.appendChild(slot);
                slot.addEventListener('change', function () { markInteraction(st); st.slot = slot.value; localStorage.setItem(LS(st.tab.k + '_slot'), st.slot); applyFilter(st); });
            }
            if (st.tab.k !== 'item' && !bar.querySelector('.afk-cs-attr')) {
                var attr = document.createElement('select'); attr.className = 'afk-cs-attr'; addOptions(attr, ATTRS, '屬性'); attr.value = st.attr; bar.appendChild(attr);
                attr.addEventListener('change', function () { markInteraction(st); st.attr = attr.value; localStorage.setItem(LS(st.tab.k + '_attr'), st.attr); applyFilter(st); });
            }
            Array.prototype.forEach.call(bar.querySelectorAll('.afk-virtual-count'), function (oldCount) { oldCount.remove(); });
            Array.prototype.forEach.call(div.querySelectorAll('.afk-add-item-btn'), function (legacy) { legacy.remove(); });
            syncFilterOffset(st, bar);
            if (!inp._afkVirtualBound) {
                inp._afkVirtualBound = true;
                inp.addEventListener('input', function () {
                    markInteraction(st);
                    localStorage.setItem(LS(st.tab.k + '_name'), inp.value || '');
                    if (inp._afkTimer) clearTimeout(inp._afkTimer);
                    inp._afkTimer = setTimeout(function () { applyFilter(st); }, 80);
                });
            }
            var host = div.querySelector('.afk-virtual-host');
            if (!host) {
                host = document.createElement('div'); host.className = 'afk-virtual-host'; host.dataset.afkPersist = '1'; host.dataset.afkKeep = '1'; div.appendChild(host);
            }
            var rowsHost = host.querySelector('.afk-virtual-rows');
            if (!rowsHost) { rowsHost = document.createElement('div'); rowsHost.className = 'afk-virtual-rows'; host.replaceChildren(rowsHost); }
            var pager = div.querySelector('.afk-inv-pager');
            if (!pager) { pager = document.createElement('nav'); pager.className = 'afk-inv-pager'; pager.dataset.afkPersist = '1'; pager.setAttribute('aria-label', '背包分頁'); div.appendChild(pager); }
            st.host = host;
            st.rowsHost = rowsHost; st.pager = pager;
        }

        var addPanel = null, addPanelState = null, addPanelAnchor = null, addFab = null;
        var junkPanel = null, junkRows = [], junkScanToken = 0, junkSaveTimer = 0, junkRebuildTimer = 0, junkActiveState = null;
        var addCatalogCache = { db: null, count: -1, rows: [] };
        var SHERINE_GROUP_KEY = 'afk_additem_sherine_group';
        var deferredAutoSort = null, autoSortPending = false;
        function sherineEffects() {
            try { return typeof SHERINE_EFFECTS !== 'undefined' && Array.isArray(SHERINE_EFFECTS) ? SHERINE_EFFECTS.slice() : []; }
            catch (e) { return []; }
        }
        function addCatalog() {
            if (typeof DB === 'undefined' || !DB.items) return [];
            var ids = Object.keys(DB.items);
            if (addCatalogCache.db === DB.items && addCatalogCache.count === ids.length) return addCatalogCache.rows;
            var rows = ids.reduce(function (list, id) {
                var def = DB.items[id];
                if (!def) return list;
                var tabKey = def.type === 'wpn' ? 'wpn' : ((def.type === 'arm' || def.type === 'acc') ? 'arm' : 'item');
                var item = { id: id, en: 0, bless: false, anc: false, attr: false, seteff: false };
                list.push({
                    id: id, def: def, tabKey: tabKey, text: normalize((def.n || '') + ' ' + id),
                    meta: { item: item, def: def, family: tabKey === 'wpn' ? weaponFamily(id, def) : (tabKey === 'arm' ? armorFamily(id, def) : '') }
                });
                return list;
            }, []);
            rows.sort(function (a, b) {
                var byName = String(a.def.n || a.id).localeCompare(String(b.def.n || b.id), 'zh-Hant');
                return byName || String(a.id).localeCompare(String(b.id));
            });
            addCatalogCache = { db: DB.items, count: ids.length, rows: rows };
            return rows;
        }
        function addCategoryKey(st) { return 'afk_additem_cat_' + st.tab.k; }
        function fillAddCategories(select, st) {
            select.replaceChildren();
            if (st.tab.k === 'wpn') { addOptions(select, WPN_FAMILIES, '武器種類'); addOptions(select, WPN_TRAITS, '武器特性'); }
            else addOptions(select, st.tab.k === 'arm' ? ARM_CATS : ITEM_CATS, '分類');
            var saved = localStorage.getItem(addCategoryKey(st)) || '';
            select.value = saved;
            if (select.value !== saved) { select.value = ''; localStorage.removeItem(addCategoryKey(st)); }
        }
        function ownedItemIds() {
            var owned = new Set();
            if (typeof player === 'undefined' || !player) return owned;
            (Array.isArray(player.inv) ? player.inv : []).forEach(function (item) { if (item && item.id) owned.add(String(item.id)); });
            if (player.eq) Object.keys(player.eq).forEach(function (slot) {
                var equipped = player.eq[slot];
                if (equipped && equipped.id) owned.add(String(equipped.id));
            });
            return owned;
        }
        function heldItemCount(id) {
            var total = 0;
            if (typeof player === 'undefined' || !player) return total;
            (Array.isArray(player.inv) ? player.inv : []).forEach(function (item) {
                if (item && String(item.id) === String(id)) total += Math.max(1, Math.floor(Number(item.cnt) || 1));
            });
            if (player.eq) Object.keys(player.eq).forEach(function (slot) {
                var equipped = player.eq[slot];
                if (equipped && String(equipped.id) === String(id)) total += Math.max(1, Math.floor(Number(equipped.cnt) || 1));
            });
            return total;
        }
        function missingItems(st, query, category) {
            if (!st || typeof DB === 'undefined' || !DB.items) return [];
            var owned = ownedItemIds(), kw = normalize(query);
            return addCatalog().reduce(function (list, entry) {
                if (entry.tabKey !== st.tab.k || owned.has(String(entry.id))) return list;
                if (kw && entry.text.indexOf(kw) < 0) return list;
                if (!categoryPassValue(st.tab.k, category || '', entry.meta)) return list;
                list.push(entry);
                return list;
            }, []);
        }
        function closeAddPanel() {
            if (addPanel && addPanel.parentNode) addPanel.parentNode.removeChild(addPanel);
            addPanel = null; addPanelState = null; addPanelAnchor = null;
        }
        function renderAddResults() {
            if (!addPanel || !addPanelState) return;
            var input = addPanel.querySelector('.afk-add-search');
            var category = addPanel.querySelector('.afk-add-category');
            var effectWrap = addPanel.querySelector('.afk-add-sherine-wrap');
            var effectSelect = addPanel.querySelector('.afk-add-sherine');
            var results = addPanel.querySelector('.afk-add-results');
            var note = addPanel.querySelector('.afk-add-note');
            if (!results) return;
            var all = missingItems(addPanelState, input ? input.value : '', category ? category.value : '');
            var shown = all.slice(0, 100);
            var hasRemains = all.some(function (entry) { return !!entry.def.remains; });
            if (effectWrap) effectWrap.classList.toggle('hidden', !hasRemains);
            results.replaceChildren();
            shown.forEach(function (entry) {
                var button = document.createElement('button'); button.type = 'button'; button.className = 'afk-add-result tip-host';
                button.dataset.tipId = String(entry.id);
                var icon = document.createElement('img'); icon.alt = ''; icon.loading = 'lazy';
                try { icon.src = typeof getIconUrl === 'function' ? getIconUrl(entry.def) : ''; } catch (e) { icon.src = ''; }
                var label = document.createElement('span');
                var name = document.createElement('b'); name.textContent = entry.def.n || entry.id;
                var idText = document.createElement('small'); idText.textContent = entry.id;
                label.appendChild(name); label.appendChild(idText); button.appendChild(icon); button.appendChild(label);
                button.addEventListener('click', function () { addMissingItem(addPanelState, entry.id, effectSelect ? effectSelect.value : ''); });
                results.appendChild(button);
            });
            if (note) note.textContent = all.length ? (all.length > 100 ? '結果較多，目前顯示前 100 筆。' : (hasRemains ? '席琳遺骸會套用上方選擇的效果；其他物品加入普通版本。' : '點選物品即可加入 1 個普通版本。')) : '沒有符合條件的未持有物品。';
        }
        function addMissingItem(st, id, sherineGroup) {
            if (!st || typeof player === 'undefined' || !player || !Array.isArray(player.inv) || typeof DB === 'undefined' || !DB.items) return;
            var def = DB.items[id];
            if (!def || !st.tab.accepts(def)) return;
            var held = heldItemCount(id);
            if ((def.unique && held >= 1) || (def.maxHold && held >= Math.max(0, Number(def.maxHold) || 0))) {
                if (typeof alert === 'function') alert('此物品已達持有上限。');
                renderAddResults();
                return;
            }
            if (ownedItemIds().has(String(id))) { renderAddResults(); return; }
            var effects = sherineEffects();
            if (def.remains && effects.indexOf(sherineGroup) < 0) {
                if (typeof alert === 'function') alert('請先選擇有效的席琳效果。');
                return;
            }
            var newUid = '';
            try { newUid = typeof uid === 'function' ? uid() : ''; } catch (e) {}
            if (!newUid) newUid = 'afk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            player.inv.push({ id: id, uid: newUid, cnt: 1, en: 0, bless: false, anc: false, attr: false, seteff: def.remains ? sherineGroup : false, lock: false, junk: false });
            if (def.remains) localStorage.setItem(SHERINE_GROUP_KEY, sherineGroup);
            try { if (typeof registerEquipObtained === 'function') registerEquipObtained(id); } catch (e) {}
            try { if (typeof registerMiscObtained === 'function') registerMiscObtained(id); } catch (e) {}
            try { if (typeof registerRelicObtained === 'function') registerRelicObtained(id); } catch (e) {}
            try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
            try { if (def.grantSkills && typeof renderSkillSelects === 'function') renderSkillSelects(); } catch (e) {}
            try { if (typeof renderTabs === 'function') renderTabs(); } catch (e) {}
            try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
            requestRebuild(st, true);
            renderAddResults();
        }
        function positionAddPanel() {
            if (!addPanel || !addPanelAnchor) return;
            var panel = addPanel.querySelector('.afk-add-dialog');
            if (!panel) return;
            var anchorRect = addPanelAnchor.getBoundingClientRect();
            var width = Math.min(460, Math.max(300, window.innerWidth - 24));
            var left = Math.min(window.innerWidth - width - 12, Math.max(12, anchorRect.right - width));
            var top = Math.min(window.innerHeight - Math.min(560, window.innerHeight - 24), Math.max(12, anchorRect.bottom + 8));
            panel.style.width = width + 'px'; panel.style.left = left + 'px'; panel.style.top = top + 'px';
        }
        function openAddPanel(st, anchor) {
            closeAddPanel(); addPanelState = st; addPanelAnchor = anchor;
            addPanel = document.createElement('div'); addPanel.id = 'afk-item-add-panel';
            addPanel.innerHTML = '<section class="afk-add-dialog" role="dialog" aria-modal="true" aria-label="新增物品">' +
                '<header><strong>＋ 新增物品</strong><button type="button" class="afk-add-close" aria-label="關閉">×</button></header>' +
                '<input class="afk-add-search" type="search" autocomplete="off" placeholder="搜尋物品名稱或 ID…">' +
                '<select class="afk-add-category" aria-label="新增物品分類"></select>' +
                '<label class="afk-add-sherine-wrap hidden"><span>席琳效果</span><select class="afk-add-sherine" aria-label="席琳效果"></select></label>' +
                '<small class="afk-add-note"></small><div class="afk-add-results"></div></section>';
            document.body.appendChild(addPanel);
            addPanel.addEventListener('click', function (e) { if (e.target === addPanel || (e.target.closest && e.target.closest('.afk-add-close'))) closeAddPanel(); });
            var input = addPanel.querySelector('.afk-add-search');
            var category = addPanel.querySelector('.afk-add-category');
            var effectSelect = addPanel.querySelector('.afk-add-sherine');
            fillAddCategories(category, st);
            var effects = sherineEffects();
            effects.forEach(function (name) { var optionEl = document.createElement('option'); optionEl.value = name; optionEl.textContent = name; effectSelect.appendChild(optionEl); });
            var savedEffect = localStorage.getItem(SHERINE_GROUP_KEY) || effects[0] || '';
            effectSelect.value = effects.indexOf(savedEffect) >= 0 ? savedEffect : (effects[0] || '');
            input.addEventListener('input', function () {
                if (input._afkTimer) clearTimeout(input._afkTimer);
                input._afkTimer = setTimeout(renderAddResults, 80);
            });
            category.addEventListener('change', function () {
                localStorage.setItem(addCategoryKey(st), category.value || '');
                renderAddResults();
            });
            effectSelect.addEventListener('change', function () { if (effectSelect.value) localStorage.setItem(SHERINE_GROUP_KEY, effectSelect.value); });
            positionAddPanel(); renderAddResults(); input.focus();
        }
        function activeInventoryState() {
            for (var i = 0; i < TABS.length; i++) if (visible(states[TABS[i].k])) return states[TABS[i].k];
            return null;
        }
        function filteredUidSet(st) {
            return new Set((st && st.filtered || []).map(function (meta) { return String(meta.item && meta.item.uid); }));
        }
        function refreshSelectionVisuals(st) {
            if (!st || !st.rowsHost) return;
            Array.prototype.forEach.call(st.rowsHost.querySelectorAll('.list-item[data-uid]'), function (node) {
                var on = st.selected.has(String(node.dataset.uid)); node.classList.toggle('afk-inv-selected', on); node.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            ensureBatchBar(st);
        }
        function pruneSelection(st) {
            if (!st || !st.selected.size) return;
            var visibleIds = filteredUidSet(st); Array.from(st.selected).forEach(function (uid) { if (!visibleIds.has(uid)) st.selected.delete(uid); });
            if (!st.selected.size) st.selectionAnchor = -1; refreshSelectionVisuals(st);
        }
        function pruneQuickJunkSelection(st) {
            try {
                var q = quickJunk && quickJunk[st.tab.k]; if (!q || !q.active || !q.sel) return;
                var visibleIds = filteredUidSet(st); Object.keys(q.sel).forEach(function (uid) { if (!visibleIds.has(String(uid))) delete q.sel[uid]; }); st.headerSig = '';
            } catch (e) {}
        }
        function setSelectionRange(st, from, to, additive) {
            if (!st) return; if (!additive) st.selected.clear();
            var a = Math.max(0, Math.min(from, to)), b = Math.min(st.filtered.length - 1, Math.max(from, to));
            for (var i = a; i <= b; i++) { var item = st.filtered[i] && st.filtered[i].item; if (item && item.uid != null) st.selected.add(String(item.uid)); }
            refreshSelectionVisuals(st);
        }
        function clearSelection(st) { if (!st) return; st.selected.clear(); st.selectionAnchor = -1; refreshSelectionVisuals(st); }
        function batchSelected(st, action) {
            if (!st || !st.selected.size) return;
            var skipped = 0, changed = 0; if (!player.junkPrefs) player.junkPrefs = {};
            (player.inv || []).forEach(function (item) {
                if (!item || item.uid == null || !st.selected.has(String(item.uid))) return;
                var def = DB.items && DB.items[item.id]; if (!def) return;
                if (action === 'junk' || action === 'keep') {
                    if (def.noJunk || (action === 'junk' && item.lock)) { skipped++; return; }
                    item.junk = action === 'junk'; var sig = ''; try { sig = itemSig(item); } catch (e) { sig = String(item.id); }
                    if (item.junk) { player.junkPrefs[sig] = true; delete item._userKeep; }
                    else { delete player.junkPrefs[sig]; item._userKeep = true; item._ruleJunk = false; delete item.junkSince; delete item._autoSellQty; }
                    changed++;
                } else {
                    item.lock = action === 'lock';
                    if (item.lock && item.junk) { item.junk = false; var lockSig = ''; try { lockSig = itemSig(item); } catch (e) { lockSig = String(item.id); } delete player.junkPrefs[lockSig]; }
                    changed++;
                }
            });
            if (action === 'junk') try { if (typeof _bumpJunkSellTimer === 'function') _bumpJunkSellTimer(); } catch (e) {}
            if (changed && typeof saveGame === 'function') saveGame();
            if (typeof logSys === 'function') logSys('批次處理完成 ' + changed + ' 件' + (skipped ? '，略過 ' + skipped + ' 件不可處理物品。' : '。'));
            requestRebuild(st, true); clearSelection(st);
        }
        function ensureBatchBar(st) {
            if (!st || !st.div) return;
            var bar = st.batchBar;
            if (!bar || !bar.isConnected) {
                bar = document.createElement('div'); bar.className = 'afk-inv-batchbar'; bar.dataset.afkPersist = '1';
                [['junk','設為廢品'],['keep','取消廢品'],['lock','鎖定'],['unlock','解鎖']].forEach(function (row) { var b = document.createElement('button'); b.type = 'button'; b.textContent = row[1]; b.onclick = function () { batchSelected(st, row[0]); }; bar.appendChild(b); });
                var clear = document.createElement('button'); clear.type = 'button'; clear.className = 'clear'; clear.textContent = '清除選取'; clear.onclick = function () { clearSelection(st); }; bar.appendChild(clear);
                var search = st.div.querySelector('.afk-isearch-plus'); if (search && search.nextSibling) st.div.insertBefore(bar, search.nextSibling); else st.div.appendChild(bar); st.batchBar = bar;
            }
            var nextHidden = !st.selected.size, changed = bar.hidden !== nextHidden;
            bar.hidden = nextHidden; bar.dataset.count = String(st.selected.size); bar.setAttribute('aria-label', '已選取 ' + st.selected.size + ' 件物品');
            if (changed && st.host) AFKRuntime.schedule('inventory:batch-size:' + st.tab.k, function () { renderWindow(st, true); }, { replace:true });
        }
        function bindMultiSelect(st) {
            if (!st || !st.div || st.div._afkMultiSelect) return; st.div._afkMultiSelect = true;
            var drag = null, suppressClick = false;
            function rowAt(target) { return target && target.closest ? target.closest('.list-item[data-uid]') : null; }
            function indexOfUid(uid) { for (var i = 0; i < st.filtered.length; i++) if (String(st.filtered[i].item.uid) === String(uid)) return i; return -1; }
            st.div.addEventListener('pointerdown', function (e) {
                var row = rowAt(e.target); if (!row || e.button !== 0 || e.target.closest('button,input,select')) return;
                var uid = String(row.dataset.uid), idx = indexOfUid(uid);
                if (e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); setSelectionRange(st, st.selectionAnchor >= 0 ? st.selectionAnchor : idx, idx, !!e.ctrlKey); st.selectionAnchor = idx; suppressClick = true; return; }
                if (e.ctrlKey) { e.preventDefault(); e.stopImmediatePropagation(); if (st.selected.has(uid)) st.selected.delete(uid); else st.selected.add(uid); st.selectionAnchor = idx; refreshSelectionVisuals(st); suppressClick = true; return; }
                drag = { x:e.clientX, y:e.clientY, start:uid, index:idx, active:false, visited:new Set(), additive:false };
            }, true);
            document.addEventListener('pointermove', function (e) {
                if (!drag || !visible(st)) return;
                if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
                if (!drag.active) { drag.active = true; st.selected.clear(); st.selected.add(drag.start); drag.visited.add(drag.start); st.selectionAnchor = drag.index; }
                e.preventDefault(); var row = rowAt(document.elementFromPoint(e.clientX, e.clientY));
                if (row && st.div.contains(row) && !drag.visited.has(String(row.dataset.uid))) { drag.visited.add(String(row.dataset.uid)); st.selected.add(String(row.dataset.uid)); refreshSelectionVisuals(st); }
            }, { passive:false });
            document.addEventListener('pointerup', function () { if (drag && drag.active) { suppressClick = true; refreshSelectionVisuals(st); } drag = null; });
            st.div.addEventListener('click', function (e) { if (!suppressClick) return; suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); }, true);
        }
        function plainInventoryName(item, def) {
            var full = def && def.n ? def.n : (item && item.id ? item.id : '');
            try { if (typeof getItemFullName === 'function') full = getItemFullName(item); } catch (e) {}
            if (typeof full !== 'string' || full.indexOf('<') < 0) return String(full || (def && def.n) || item.id || '');
            var box = document.createElement('span'); box.innerHTML = full;
            return (box.textContent || (def && def.n) || item.id || '').replace(/\s+/g, ' ').trim();
        }
        function junkEligible(item, def) { return !!(item && def && !item.lock && !def.noJunk); }
        function closeJunkPanel() {
            junkScanToken++;
            if (junkPanel && junkPanel.parentNode) junkPanel.parentNode.removeChild(junkPanel);
            junkPanel = null; junkRows = []; junkActiveState = null;
        }
        function scheduleJunkStateSave() {
            if (junkSaveTimer) clearTimeout(junkSaveTimer);
            junkSaveTimer = setTimeout(function () { junkSaveTimer = 0; if (typeof saveGame === 'function') saveGame(); }, 300);
            if (junkRebuildTimer) clearTimeout(junkRebuildTimer);
            junkRebuildTimer = setTimeout(function () {
                junkRebuildTimer = 0;
                var st = activeInventoryState(); if (st) requestRebuild(st, true);
            }, 120);
        }
        function setJunkState(item, enabled) {
            var def = item && DB.items ? DB.items[item.id] : null;
            if (!junkEligible(item, def)) return;
            if (!player.junkPrefs) player.junkPrefs = {};
            item.junk = !!enabled;
            var sig = ''; try { sig = typeof itemSig === 'function' ? itemSig(item) : String(item.id); } catch (e) { sig = String(item.id); }
            if (enabled) {
                player.junkPrefs[sig] = true; delete item._userKeep;
                try { if (typeof _bumpJunkSellTimer === 'function') _bumpJunkSellTimer(); } catch (e) {}
            } else {
                delete player.junkPrefs[sig];
                if (item._ruleJunk) { item._userKeep = true; item._ruleJunk = false; delete item.junkSince; delete item._autoSellQty; }
            }
            scheduleJunkStateSave(); renderJunkRows();
        }
        function forgetHistoricalJunk(row) {
            if (!row || !row.historical || !row.sig || !player.junkPrefs) return;
            delete player.junkPrefs[row.sig];
            junkRows = junkRows.filter(function (entry) { return entry !== row; });
            scheduleJunkStateSave(); renderJunkRows();
        }
        function itemFromJunkSignature(sig) {
            var parts = String(sig || '').split('|'), id = parts[0], def = DB.items && DB.items[id];
            if (!id || !def) return null;
            var anc = parts[3] === 'A' ? true : (parts[3] && parts[3] !== '0' ? parts[3] : false);
            return { id:id, uid:'afk-junk-memory:' + sig, cnt:0, en:Math.max(0, Number(parts[1]) || 0), bless:parts[2] === 'B' ? true : (parts[2] === 'C' ? 'cursed' : false), anc:anc, attr:parts[4] || false, seteff:parts[5] || false, lock:false, junk:true, _afkHistoricalJunk:true };
        }
        function junkFilterKey(kind) {
            return 'afk_junk_filter_' + (junkActiveState ? junkActiveState.tab.k : 'item') + '_' + kind;
        }
        function junkMeta(row) {
            var tabKey = junkActiveState ? junkActiveState.tab.k : 'item';
            return { item:row.item, def:row.def, family:tabKey === 'wpn' ? weaponFamily(row.item.id, row.def) : (tabKey === 'arm' ? armorFamily(row.item.id, row.def) : '') };
        }
        function fillJunkFilters() {
            if (!junkPanel || !junkActiveState) return;
            var category = junkPanel.querySelector('.afk-junk-category');
            var attr = junkPanel.querySelector('.afk-junk-attr');
            if (category) {
                category.replaceChildren();
                if (junkActiveState.tab.k === 'wpn') { addOptions(category, WPN_FAMILIES, '武器種類'); addOptions(category, WPN_TRAITS, '武器特性'); }
                else addOptions(category, junkActiveState.tab.k === 'arm' ? ARM_CATS : ITEM_CATS, '分類');
                var savedCategory = localStorage.getItem(junkFilterKey('category')) || '';
                category.value = savedCategory;
                if (category.value !== savedCategory) { category.value = ''; localStorage.removeItem(junkFilterKey('category')); }
            }
            if (attr) {
                attr.replaceChildren(); addOptions(attr, ATTRS);
                attr.hidden = junkActiveState.tab.k === 'item';
                var savedAttr = attr.hidden ? '' : (localStorage.getItem(junkFilterKey('attr')) || '');
                attr.value = savedAttr;
                if (attr.value !== savedAttr) { attr.value = ''; localStorage.removeItem(junkFilterKey('attr')); }
            }
        }
        function renderJunkRows() {
            if (!junkPanel) return;
            var input = junkPanel.querySelector('.afk-junk-search'), onlyBtn = junkPanel.querySelector('.afk-junk-only');
            var category = junkPanel.querySelector('.afk-junk-category'), attrSelect = junkPanel.querySelector('.afk-junk-attr');
            var host = junkPanel.querySelector('.afk-junk-list'), summary = junkPanel.querySelector('.afk-junk-summary');
            if (!host) return;
            var query = normalize(input ? input.value : ''), only = localStorage.getItem(junkFilterKey('only')) !== 'false';
            var categoryValue = category ? category.value : '', attrValue = attrSelect && !attrSelect.hidden ? attrSelect.value : '';
            var attrRule = findRule(ATTRS, attrValue);
            if (onlyBtn) { onlyBtn.classList.toggle('active', only); onlyBtn.setAttribute('aria-pressed', only ? 'true' : 'false'); onlyBtn.textContent = only ? '僅顯示廢品：開' : '僅顯示廢品：關'; }
            var matched = junkRows.filter(function (row) {
                var meta = junkMeta(row);
                return (!only || row.item.junk) && (!query || row.text.indexOf(query) >= 0) &&
                    categoryPassValue(junkActiveState.tab.k, categoryValue, meta) && (!attrRule || !attrRule.t || attrRule.t(meta));
            });
            host.replaceChildren();
            matched.slice(0, 300).forEach(function (row) {
                var line = document.createElement('div'); line.className = 'afk-junk-row';
                var icon = document.createElement('img'); icon.alt = ''; icon.loading = 'lazy'; try { icon.src = getIconUrl(row.def); } catch (e) {}
                var info = document.createElement('span'), name = document.createElement('b'), id = document.createElement('small');
                name.textContent = row.name + (row.historical ? '（背包外記憶）' : (((Number(row.item.cnt) || 1) > 1 ? ' ×' + row.item.cnt : ''))); id.textContent = row.item.id;
                info.appendChild(name); info.appendChild(id);
                var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'afk-ui-toggle' + (row.item.junk ? ' active' : '');
                toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-checked', row.item.junk ? 'true' : 'false'); toggle.textContent = row.historical ? '取消記憶' : (row.item.junk ? '已標記' : '保留');
                toggle.onclick = function () { if (row.historical) forgetHistoricalJunk(row); else setJunkState(row.item, !row.item.junk); };
                if (row.historical) line.classList.add('historical');
                line.appendChild(icon); line.appendChild(info); line.appendChild(toggle); host.appendChild(line);
            });
            if (!matched.length) { var empty = document.createElement('div'); empty.className = 'afk-junk-empty'; empty.textContent = only ? '目前沒有已標記的廢品。' : '沒有符合搜尋條件的物品。'; host.appendChild(empty); }
            var totalJunk = junkRows.filter(function (row) { return !!row.item.junk; }).length;
            if (summary) summary.textContent = '目前廢品 ' + totalJunk + ' 筆' + (matched.length > 300 ? '；結果較多，顯示前 300 筆' : '');
        }
        function scanJunkRows() {
            var token = ++junkScanToken, inv = player && Array.isArray(player.inv) ? player.inv : [], index = 0, represented = new Set();
            junkRows = [];
            function work() {
                if (!junkPanel || token !== junkScanToken) return;
                var started = performance.now(), handled = 0;
                while (index < inv.length && handled < 120) {
                    var item = inv[index++], def = item && DB.items ? DB.items[item.id] : null;
                    if (junkEligible(item, def) && (!junkActiveState || junkActiveState.tab.accepts(def))) {
                        var name = plainInventoryName(item, def), sig = '';
                        try { sig = typeof itemSig === 'function' ? itemSig(item) : String(item.id); } catch (e) { sig = String(item.id); }
                        represented.add(sig); junkRows.push({ item:item, def:def, name:name, sig:sig, historical:false, text:normalize(name + ' ' + item.id) });
                    }
                    handled++;
                    var pending = false; try { pending = !!(navigator.scheduling && navigator.scheduling.isInputPending && navigator.scheduling.isInputPending()); } catch (e) {}
                    if (pending || performance.now() - started >= 3) break;
                }
                if (index < inv.length) { if (typeof requestIdleCallback === 'function') requestIdleCallback(work, { timeout:50 }); else setTimeout(work, 0); return; }
                Object.keys(player.junkPrefs || {}).forEach(function (sig) {
                    if (!player.junkPrefs[sig] || represented.has(sig)) return;
                    var item = itemFromJunkSignature(sig), def = item && DB.items[item.id];
                    if (!item || !def || def.noJunk || (junkActiveState && !junkActiveState.tab.accepts(def))) return;
                    var name = plainInventoryName(item, def);
                    junkRows.push({ item:item, def:def, name:name, sig:sig, historical:true, text:normalize(name + ' ' + item.id + ' 背包外記憶') });
                });
                junkRows.sort(function (a, b) { return (Number(b.item.junk) - Number(a.item.junk)) || (Number(b.historical) - Number(a.historical)) || a.name.localeCompare(b.name, 'zh-Hant'); });
                renderJunkRows();
            }
            work();
        }
        function openJunkPanel() {
            closeJunkPanel();
            junkActiveState = activeInventoryState();
            if (!junkActiveState) return;
            var tabName = junkActiveState.tab.k === 'wpn' ? '武器' : (junkActiveState.tab.k === 'arm' ? '防具' : '道具');
            junkPanel = document.createElement('div'); junkPanel.id = 'afk-junk-manager';
            junkPanel.innerHTML = '<section class="afk-junk-dialog" role="dialog" aria-modal="true" aria-label="' + tabName + '廢品清單"><header><div><strong>🗑️ ' + tabName + '廢品清單</strong><small class="afk-junk-summary">讀取中…</small></div><button type="button" class="afk-junk-close" aria-label="關閉">×</button></header><div class="afk-junk-tools"><input class="afk-junk-search" type="search" autocomplete="off" placeholder="搜尋' + tabName + '名稱或 ID…"><button type="button" class="afk-junk-only afk-ui-toggle" aria-pressed="true">僅顯示廢品：開</button></div><div class="afk-junk-filters"><select class="afk-junk-category" aria-label="' + tabName + '廢品分類"></select><select class="afk-junk-attr" aria-label="' + tabName + '廢品屬性"></select></div><div class="afk-junk-note">搜尋、分類、屬性與廢品狀態會聯合篩選；包含已售出或暫時不在背包的廢品記憶。</div><div class="afk-junk-list"><div class="afk-junk-empty">讀取中…</div></div></section>';
            document.body.appendChild(junkPanel);
            junkPanel.onclick = function (e) { if (e.target === junkPanel || (e.target.closest && e.target.closest('.afk-junk-close'))) closeJunkPanel(); };
            var search = junkPanel.querySelector('.afk-junk-search');
            search.value = localStorage.getItem(junkFilterKey('search')) || '';
            search.oninput = function () { localStorage.setItem(junkFilterKey('search'), search.value || ''); if (search._timer) clearTimeout(search._timer); search._timer = setTimeout(renderJunkRows, 70); };
            var onlyKey = junkFilterKey('only');
            if (localStorage.getItem(onlyKey) === null) localStorage.setItem(onlyKey, localStorage.getItem('afk_junk_view_only') === 'false' ? 'false' : 'true');
            junkPanel.querySelector('.afk-junk-only').onclick = function () { var next = localStorage.getItem(onlyKey) === 'false'; localStorage.setItem(onlyKey, String(next)); renderJunkRows(); };
            fillJunkFilters();
            junkPanel.querySelector('.afk-junk-category').onchange = function (e) { localStorage.setItem(junkFilterKey('category'), e.target.value || ''); renderJunkRows(); };
            junkPanel.querySelector('.afk-junk-attr').onchange = function (e) { localStorage.setItem(junkFilterKey('attr'), e.target.value || ''); renderJunkRows(); };
            scanJunkRows(); search.focus();
        }
        function decorateJunkHeader(header) {
            if (!header || header.querySelector('.afk-junk-list-btn')) return;
            var row = header.firstElementChild || header;
            var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'afk-junk-list-btn'; btn.textContent = '🧾 廢品清單'; btn.title = '查詢並調整所有已標記廢品';
            btn.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openJunkPanel(); };
            row.appendChild(btn);
        }
        function syncAddFab() {
            if (!addFab) return;
            var st = activeInventoryState();
            addFab.classList.toggle('visible', !!st);
            addFab._afkState = st;
            TABS.forEach(function (tab) { var s = states[tab.k]; if (s.div) s.div.classList.toggle('afk-has-add-fab', !!st && s === st); });
            if (!st && addPanel) closeAddPanel();
        }
        function ensureAddFab() {
            var container = document.getElementById('tab-content-panel');
            if (!container) return null;
            addFab = container.querySelector('#afk-add-item-fab');
            if (!addFab) {
                addFab = document.createElement('button'); addFab.id = 'afk-add-item-fab'; addFab.type = 'button'; addFab.textContent = '＋';
                addFab.setAttribute('aria-label', '新增物品'); addFab.title = '新增物品';
                addFab.addEventListener('click', function (e) {
                    e.preventDefault(); e.stopPropagation();
                    var st = addFab._afkState || activeInventoryState();
                    if (st) openAddPanel(st, addFab);
                });
                container.appendChild(addFab);
            }
            syncAddFab();
            return addFab;
        }
        function hookAutoSort() {
            if (deferredAutoSort || typeof window.autoSortInventory !== 'function') return;
            deferredAutoSort = window.autoSortInventory;
            window.autoSortInventory = function () {
                if (activeInventoryState()) { autoSortPending = true; return; }
                return deferredAutoSort.apply(this, arguments);
            };
            window.autoSortInventory.__afkV315 = true;
        }
        function flushDeferredAutoSort() {
            if (!autoSortPending || !deferredAutoSort) return false;
            autoSortPending = false; window.__afkSuppressSortRender = true;
            try { deferredAutoSort.call(window); } catch (e) { console.warn('[AFK] 延後排列失敗', e); }
            finally { window.__afkSuppressSortRender = false; }
            return true;
        }
        window.addEventListener('resize', positionAddPanel, { passive: true });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (addPanel) { closeAddPanel(); e.preventDefault(); e.stopImmediatePropagation(); return; }
            if (junkPanel) { closeJunkPanel(); e.preventDefault(); e.stopImmediatePropagation(); return; }
            var st = activeInventoryState(); if (!st) return;
            try {
                var qe = typeof quickEnh !== 'undefined' && quickEnh[st.tab.k];
                if (qe && qe.active && typeof cancelQuickEnhance === 'function') { cancelQuickEnhance(st.tab.k); e.preventDefault(); e.stopImmediatePropagation(); return; }
                var qj = typeof quickJunk !== 'undefined' && quickJunk[st.tab.k];
                if (qj && qj.active && typeof cancelQuickJunk === 'function') { cancelQuickJunk(st.tab.k); e.preventDefault(); e.stopImmediatePropagation(); return; }
            } catch (err) {}
            if (st.selected.size) { clearSelection(st); e.preventDefault(); e.stopImmediatePropagation(); }
        }, true);

        function rowSignature(item, def, st, contextSig) {
            var sig = '';
            try { sig = typeof itemSig === 'function' ? itemSig(item) : String(item.id || ''); } catch (e) { sig = String(item.id || ''); }
            var quick = '';
            try {
                var qeType = def.type === 'wpn' && !def.isArrow ? 'wpn' : ((def.type === 'arm' || def.type === 'acc') ? 'arm' : null);
                var qjType = def.type === 'wpn' ? 'wpn' : ((def.type === 'arm' || def.type === 'acc') ? 'arm' : 'item');
                if (qeType && typeof quickEnh !== 'undefined' && quickEnh[qeType].active) quick += '|qe:' + (quickEnh[qeType].sel[item.uid] ? 1 : 0);
                if (typeof quickJunk !== 'undefined' && quickJunk[qjType].active) quick += '|qj:' + (quickJunk[qjType].sel[item.uid] ? 1 : 0);
            } catch (e) {}
            return sig + '|c:' + (item.cnt || 1) + '|l:' + (item.lock ? 1 : 0) + '|j:' + (item.junk ? 1 : 0) + quick + '|' + contextSig;
        }
        function itemMeta(item, def, index, st, contextSig) {
            var sig = rowSignature(item, def, st, contextSig);
            var cachedMeta = metaCache.get(item);
            if (cachedMeta && cachedMeta.sig === sig && cachedMeta.tabKey === st.tab.k && cachedMeta.def === def) {
                cachedMeta.meta.index = index;
                if (item.uid == null) cachedMeta.meta.key = String(item.id) + '@' + index;
                return cachedMeta.meta;
            }
            var full = '';
            try { full = typeof getItemFullName === 'function' ? getItemFullName(item) : (def.n || item.id); } catch (e) { full = def.n || item.id; }
            var meta = {
                item: item, def: def, index: index, key: String(item.uid == null ? item.id + '@' + index : item.uid),
                sig: sig,
                text: normalize(full + ' ' + (def.n || '') + ' ' + item.id),
                family: st.tab.k === 'wpn' ? weaponFamily(item.id, def) : (st.tab.k === 'arm' ? armorFamily(item.id, def) : '')
            };
            metaCache.set(item, { sig: sig, tabKey: st.tab.k, def: def, meta: meta });
            return meta;
        }
        function buildRow(meta, st) {
            var i = meta.item, d = meta.def, el = document.createElement('div');
            var statusTag = '', itemBg = 'bg-slate-800';
            if (d.type === 'skillbk') {
                var sk = typeof DB !== 'undefined' && DB.skills ? DB.skills[d.sk] : null;
                var possible = sk && typeof skillReqLv === 'function' ? skillReqLv(sk, d.sk) !== undefined : true;
                if (player.skills && player.skills.indexOf(d.sk) >= 0) { statusTag = '<span class="text-slate-500 text-[10px] font-bold">[已學習]</span>'; itemBg = 'bg-slate-900 opacity-70'; }
                else if (!possible) { statusTag = '<span class="text-red-500 text-[10px] font-bold">[無法學習]</span>'; itemBg = 'bg-red-950/40'; }
            } else if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') {
                try { if (typeof checkCanEquip === 'function' && !checkCanEquip(i)) { statusTag = '<span class="text-red-500 text-[10px] font-bold">[無法裝備]</span>'; itemBg = 'bg-red-950/40'; } } catch (e) {}
            }
            el.className = 'list-item text-base ' + itemBg + ' rounded mb-1 ' + (i.lock ? 'border-red-900 border-2' : '');
            el.dataset.afkKeep = '1'; el.dataset.iid = String(i.id); if (i.uid != null) el.dataset.uid = String(i.uid);
            if (i.uid != null && st.selected.has(String(i.uid))) { el.classList.add('afk-inv-selected'); el.setAttribute('aria-selected', 'true'); }
            var imgUrl = '', glow = '', color = '', name = d.n || i.id;
            try { imgUrl = getIconUrl(d); } catch (e) {}
            try { glow = getGlowClass(i, d); } catch (e) {}
            try { color = getItemColor(i); } catch (e) {}
            try { name = getItemFullName(i); } catch (e) {}
            var trialName = (typeof TRIAL_ITEM_CLASS !== 'undefined' && TRIAL_ITEM_CLASS[i.id]) || isExtraTrialGuideItem(i.id)
                ? '<button type="button" class="afk-trial-link ' + color + ' font-bold" data-afk-trial-item="' + String(i.id) + '">' + name + '</button>'
                : '<span class="' + color + ' font-bold">' + name + '</span>';
            var rowInner = '<div class="flex items-center gap-2"><img src="' + imgUrl + '" onerror="this.style.opacity=\'0\';" class="w-6 h-6 object-contain pointer-events-none ' + glow + '">' + trialName + ' ' + statusTag + (i.lock ? '<span class="text-xs text-red-500">[🔒]</span>' : '') + ((i.junk && !i.lock) ? '<span class="text-xs text-amber-400 font-bold">[廢]</span>' : '') + '</div>';
            var qeType = d.type === 'wpn' && !d.isArrow ? 'wpn' : ((d.type === 'arm' || d.type === 'acc') ? 'arm' : null);
            var qjType = d.type === 'wpn' ? 'wpn' : ((d.type === 'arm' || d.type === 'acc') ? 'arm' : 'item');
            var traditional = false; try { traditional = typeof traditionalActive === 'function' && traditionalActive(); } catch (e) {}
            if (qeType && typeof quickEnh !== 'undefined' && quickEnh[qeType].active && !i.lock && !traditional) {
                var qeChecked = !!quickEnh[qeType].sel[i.uid];
                el.innerHTML = '<div class="flex items-center justify-between gap-2">' + rowInner + '<input type="checkbox" class="pointer-events-none w-4 h-4 mr-1 flex-shrink-0" ' + (qeChecked ? 'checked' : '') + '></div>';
                if (qeChecked) el.className += ' ring-2 ring-blue-500/70';
                el.onclick = function () { toggleQuickItem(qeType, i.uid); };
            } else if (typeof quickJunk !== 'undefined' && quickJunk[qjType].active && !i.lock) {
                var qjChecked = !!quickJunk[qjType].sel[i.uid];
                el.innerHTML = '<div class="flex items-center justify-between gap-2">' + rowInner + '<input type="checkbox" class="pointer-events-none w-4 h-4 mr-1 flex-shrink-0" ' + (qjChecked ? 'checked' : '') + '></div>';
                if (qjChecked) el.className += ' ring-2 ring-amber-500/70';
                el.onclick = function () { toggleQuickJunkItem(qjType, i.uid); };
            } else {
                el.innerHTML = rowInner;
                var dbl = (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') ? 'equip' : ((i.id !== 'candle' && (d.type === 'pot' || d.type === 'skillbk' || d.type === 'scroll' || (d.type === 'misc' && d.eff && !d.noUse))) ? 'use' : null);
                if (dbl) {
                    el.onclick = function () { clearTimeout(window._invClickTimer); window._invClickTimer = setTimeout(function () { openModal(i, false); }, 230); };
                    el.ondblclick = function (ev) { clearTimeout(window._invClickTimer); ev.preventDefault(); ev.stopPropagation(); if (dbl === 'equip') equipItem(i); else useItem(i.uid); };
                } else el.onclick = function () { openModal(i, false); };
            }
            return el;
        }
        function calculatePageSize(st) {
            if (!st || !st.div) return st && st.pageSize || 10;
            var header = st.div.querySelector('[data-afk-virtual-header="1"]');
            var filter = st.div.querySelector('.afk-isearch,.afk-isearch-plus');
            var batch = st.batchBar && !st.batchBar.hidden ? st.batchBar : null;
            var used = 64;
            try { var css = getComputedStyle(st.div); used += parseFloat(css.paddingTop || 0) + parseFloat(css.paddingBottom || 0); } catch (e) {}
            [header, filter, batch, st.pager].forEach(function (el) { if (el && el.isConnected) used += Math.ceil(el.getBoundingClientRect().height || 0); });
            var available = Math.max(st.rowHeight * MIN_PAGE_SIZE, (st.div.clientHeight || 600) - used);
            return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, Math.floor(available / Math.max(24, st.rowHeight))));
        }
        function windowRange(st, list) {
            st.pageSize = calculatePageSize(st);
            st.pageCount = Math.max(1, Math.ceil(list.length / st.pageSize));
            st.page = Math.max(0, Math.min(st.page, st.pageCount - 1));
            var start = st.page * st.pageSize;
            return { start:start, end:Math.min(list.length, start + st.pageSize) };
        }
        function windowFingerprint(st, list) {
            if (!st.div) return '';
            var range = windowRange(st, list);
            var parts = [];
            for (var i = range.start; i < range.end; i++) parts.push(list[i].key + ':' + list[i].sig);
            return range.start + '|' + range.end + '|' + parts.join('~');
        }
        function sameVisibleRefs(st, before, after) {
            var a = windowRange(st, before), b = windowRange(st, after);
            if (a.start !== b.start || a.end !== b.end) return false;
            for (var i = a.start; i < a.end; i++) {
                if (!before[i] || !after[i] || before[i].key !== after[i].key || before[i].sig !== after[i].sig || before[i].item !== after[i].item) return false;
            }
            return true;
        }
        function setPage(st, page) {
            if (!st) return;
            var count = Math.max(1, Math.ceil(st.filtered.length / Math.max(1, st.pageSize)));
            var next = Math.max(0, Math.min(Number(page) || 0, count - 1));
            if (next === st.page && st.pager && st.pager.children.length) return;
            st.page = next; markInteraction(st); renderWindow(st, true);
        }
        function updatePaginator(st) {
            if (!st || !st.pager) return;
            var total = st.filtered.length, pages = Math.max(1, st.pageCount), current = Math.min(st.page, pages - 1);
            st.pager.replaceChildren();
            function button(label, page, disabled, active) {
                var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = !!disabled;
                if (active) { b.className = 'active'; b.setAttribute('aria-current', 'page'); }
                b.addEventListener('click', function () { setPage(st, page); }); return b;
            }
            st.pager.appendChild(button('‹ 上一頁', current - 1, current <= 0, false));
            var start = Math.max(0, Math.min(current - 2, pages - 5)), end = Math.min(pages, start + 5);
            for (var i = start; i < end; i++) st.pager.appendChild(button(String(i + 1), i, false, i === current));
            st.pager.appendChild(button('下一頁 ›', current + 1, current >= pages - 1, false));
            var info = document.createElement('span'); info.textContent = '第 ' + (total ? current + 1 : 0) + '／' + (total ? pages : 0) + ' 頁・共 ' + total + ' 件'; st.pager.appendChild(info);
        }
        function reconcileVisibleRows(st, desired) {
            var parent = st.rowsHost;
            if (!parent) return;
            var cursor = parent.firstChild;
            desired.forEach(function (node) {
                if (node === cursor) cursor = cursor.nextSibling;
                else parent.insertBefore(node, cursor);
            });
            while (cursor) { var next = cursor.nextSibling; parent.removeChild(cursor); cursor = next; }
        }
        function measureRowHeightOnce(st) {
            if (st.rowHeightReady || st.measureRaf || !st.rowsHost) return;
            var sample = st.rowsHost.querySelector('.list-item');
            if (!sample) return;
            st.measureRaf = requestAnimationFrame(function () {
                st.measureRaf = 0;
                if (!sample.isConnected) return;
                var measured = Math.max(24, Math.round(sample.getBoundingClientRect().height + 4));
                st.rowHeightReady = true;
                if (Math.abs(measured - st.rowHeight) > 2) { st.rowHeight = measured; renderWindow(st, true); }
            });
        }
        function renderWindow(st, force) {
            if (!st.host || !st.rowsHost || !st.div) return;
            if (force && st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
            if (st.raf && !force) return;
            var run = function () {
                st.raf = 0;
                var range = windowRange(st, st.filtered), start = range.start, end = range.end;
                var desired = [];
                if (!st.filtered.length) {
                    var empty = document.createElement('div');
                    empty.className = 'afk-inv-placeholder';
                    if (!st.initialReady) empty.textContent = '讀取中…';
                    else if (!st.rows.length) empty.textContent = st.tab.k === 'wpn' ? '目前沒有武器' : (st.tab.k === 'arm' ? '目前沒有防具' : '目前沒有道具');
                    else empty.textContent = '目前沒有符合條件的物品';
                    desired.push(empty);
                    reconcileVisibleRows(st, desired);
                    updatePaginator(st);
                    return;
                }
                for (var x = start; x < end; x++) {
                    var meta = st.filtered[x], cached = st.nodes.get(meta.key), node = cached && cached.sig === meta.sig && cached.item === meta.item ? cached.node : null;
                    if (!node) { node = buildRow(meta, st); st.nodes.set(meta.key, { sig: meta.sig, item: meta.item, node: node }); }
                    desired.push(node);
                }
                reconcileVisibleRows(st, desired);
                updatePaginator(st);
                measureRowHeightOnce(st);
                refreshSelectionVisuals(st);
            };
            if (force) run(); else st.raf = requestAnimationFrame(run);
        }
        function visible(st) { return !!(st.div && !st.div.classList.contains('hidden')); }
        function commitStaged(st) {
            if (st.commitTimer) { clearTimeout(st.commitTimer); st.commitTimer = 0; }
            if (!st.stagedRows || !visible(st)) return;
            var wait = st.interactionUntil - Date.now();
            if (wait > 0) {
                st.commitTimer = setTimeout(function () { st.commitTimer = 0; commitStaged(st); }, wait + 20);
                return;
            }
            var before = windowFingerprint(st, st.filtered);
            var staged = st.stagedRows; st.stagedRows = null;
            var nextFiltered = filterRows(st, staged.rows);
            var sameRefs = sameVisibleRefs(st, st.filtered, nextFiltered);
            var after = windowFingerprint(st, nextFiltered);
            st.rows = staged.rows; st.filtered = nextFiltered; st.filterKey = currentFilterKey(st); st.initialReady = true;
            st.pageCount = Math.max(1, Math.ceil(st.filtered.length / Math.max(1, st.pageSize)));
            st.page = Math.max(0, Math.min(st.page, st.pageCount - 1));
            var valid = new Set(st.rows.map(function (meta) { return meta.key; }));
            st.nodes.forEach(function (_, key) { if (!valid.has(key)) st.nodes.delete(key); });
            if (!st.host || !st.host.children.length || before !== after || !sameRefs) renderWindow(st, true);
            else updatePaginator(st);
        }
        function scheduleCommit(st) {
            if (!st || !st.stagedRows || st.commitTimer) return;
            var wait = Math.max(0, st.interactionUntil - Date.now());
            st.commitTimer = setTimeout(function () { st.commitTimer = 0; commitStaged(st); }, wait + 20);
        }
        function quickHeaderSignature(key) {
            try {
                var qe = typeof quickEnh !== 'undefined' && quickEnh[key] ? quickEnh[key] : null;
                var qj = typeof quickJunk !== 'undefined' && quickJunk[key] ? quickJunk[key] : null;
                return [qe && qe.active ? 1 : 0, qe && qe.target, qe && qe.useBless ? 1 : 0, qe && qe.useCurse ? 1 : 0,
                    qe ? Object.keys(qe.sel || {}).length : 0, qj && qj.active ? 1 : 0, qj ? Object.keys(qj.sel || {}).length : 0].join('|');
            } catch (e) { return String(Date.now()); }
        }
        function ensureHeader(st) {
            if (!st.div || typeof buildQuickHeader !== 'function') return;
            var sig = quickHeaderSignature(st.tab.k);
            var current = st.div.querySelector('[data-afk-virtual-header="1"]');
            if (current && st.headerSig === sig) { syncStickyOffset(st, current); return; }
            var header = buildQuickHeader(st.tab.k);
            header.dataset.afkVirtualHeader = '1';
            header.classList.add('afk-quick-header');
            decorateJunkHeader(header);
            if (current && current.parentNode) current.parentNode.replaceChild(header, current);
            else st.div.insertBefore(header, st.div.firstElementChild);
            st.headerSig = sig;
            syncStickyOffset(st, header);
        }

        function syncStickyOffset(st, header) {
            if (!st || !st.div || !header) return;
            if (st.headerObserved === header) return;
            st.headerObserved = header;
            var apply = function (height) {
                if (!header.isConnected || !st.div) return;
                var value = height == null ? header.getBoundingClientRect().height : height;
                st.div.style.setProperty('--afk-quick-header-height', Math.max(0, Math.ceil(value)) + 'px');
            };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { apply(null); }); else setTimeout(function () { apply(null); }, 0);
            if (typeof ResizeObserver === 'function') {
                if (!st.headerObserver) st.headerObserver = new ResizeObserver(function (entries) { if (entries[0]) apply(entries[0].contentRect.height); });
                else st.headerObserver.disconnect();
                st.headerObserver.observe(header);
            }
        }
        function syncFilterOffset(st, bar) {
            if (!st || !st.div || !bar) return;
            if (st.filterObserved === bar) return;
            st.filterObserved = bar;
            var apply = function (height) {
                if (!bar.isConnected || !st.div) return;
                var value = height == null ? bar.getBoundingClientRect().height : height;
                st.div.style.setProperty('--afk-filter-height', Math.max(0, Math.ceil(value)) + 'px');
            };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { apply(null); }); else setTimeout(function () { apply(null); }, 0);
            if (typeof ResizeObserver === 'function') {
                if (!st.filterObserver) st.filterObserver = new ResizeObserver(function (entries) {
                    if (!entries[0]) return;
                    var rect = entries[0].contentRect;
                    if (Math.abs((st.filterWidth || 0) - rect.width) > 1) {
                        st.filterWidth = rect.width; st.rowHeightReady = false;
                        if (visible(st) && st.rowsHost && st.rowsHost.children.length) renderWindow(st, true);
                    }
                    apply(rect.height);
                });
                else st.filterObserver.disconnect();
                st.filterObserver.observe(bar);
            }
        }
        function startSharedRebuild() {
            if (sharedIndex.running || !TABS.some(function (tab) { return visible(states[tab.k]); })) return;
            sharedIndex.running = true; sharedIndex.buildVersion = sharedIndex.requestedVersion;
            var inv = typeof player !== 'undefined' && player && Array.isArray(player.inv) ? player.inv : [];
            var length = inv.length, index = 0, staged = { wpn: [], arm: [], item: [] };
            var contextSig = '';
            try { contextSig = [player.cls, player.lv, (player.skills || []).join(','), (player.grantedSkills || []).join(','), player.elfEle || ''].join('#'); } catch (e) {}
            TABS.forEach(function (tab) { var st = states[tab.k]; st.building = true; st.buildVersion = sharedIndex.buildVersion; st.stale = false; if (visible(st) && !st.initialReady) renderWindow(st, true); });
            function work() {
                var started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
                var handled = 0;
                while (index < length && handled < 100) {
                    var item = inv[index], def = item && typeof DB !== 'undefined' && DB.items ? DB.items[item.id] : null;
                    if (def) {
                        var key = def.type === 'wpn' ? 'wpn' : ((def.type === 'arm' || def.type === 'acc') ? 'arm' : 'item');
                        staged[key].push(itemMeta(item, def, index, states[key], contextSig));
                    }
                    index++; handled++;
                    var now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
                    var inputPending = false;
                    try { inputPending = !!(navigator.scheduling && navigator.scheduling.isInputPending && navigator.scheduling.isInputPending()); } catch (e) {}
                    if (inputPending || now - started >= 2) break;
                }
                if (index < length) {
                    if (typeof requestIdleCallback === 'function') requestIdleCallback(work, { timeout: 50 });
                    else setTimeout(work, 0);
                    return;
                }
                sharedIndex.running = false; sharedIndex.lastBuildAt = Date.now();
                TABS.forEach(function (tab) {
                    var st = states[tab.k]; st.building = false; st.lastBuildAt = sharedIndex.lastBuildAt;
                    st.stagedRows = { rows: staged[tab.k], version: sharedIndex.buildVersion };
                    st.stale = sharedIndex.requestedVersion > sharedIndex.buildVersion;
                    if (visible(st)) scheduleCommit(st);
                });
                if (sharedIndex.requestedVersion > sharedIndex.buildVersion) queueSharedRebuild(false);
            }
            work();
        }
        function queueSharedRebuild(immediate) {
            if (sharedIndex.running || !TABS.some(function (tab) { return visible(states[tab.k]); })) return;
            if (sharedIndex.timer) {
                if (!immediate) return;
                clearTimeout(sharedIndex.timer); sharedIndex.timer = 0;
            }
            var wait = immediate ? 0 : Math.max(120, sharedIndex.lastBuildAt + MIN_REBUILD_GAP - Date.now());
            sharedIndex.timer = setTimeout(function () {
                sharedIndex.timer = 0;
                startSharedRebuild();
            }, wait);
        }
        function queueRebuild(st, immediate) { if (st && st.div) queueSharedRebuild(immediate); }
        function requestRebuild(st, immediate) {
            if (!st || !st.div) return;
            sharedIndex.requestedVersion++;
            TABS.forEach(function (tab) { states[tab.k].dirtyVersion = sharedIndex.requestedVersion; states[tab.k].stale = true; });
            queueSharedRebuild(!!immediate);
        }
        function hook() {
            if (typeof window._renderInvTabs !== 'function' || typeof window._clearInvTab !== 'function' || typeof window.buildQuickHeader !== 'function' || typeof DB === 'undefined') return;
            if (window.__afkVirtualInventoryV315) return;
            TABS.forEach(function (tab) {
                var st = states[tab.k]; st.div = document.getElementById(tab.id); if (!st.div) return;
                ensureUI(st); _clearInvTab(st.div); ensureUI(st); ensureHeader(st);
                st.div.addEventListener('pointerdown', function () { markInteraction(st); }, { passive: true });
                if (typeof ResizeObserver === 'function') {
                    st.resizeObserver = new ResizeObserver(function () {
                        AFKRuntime.schedule('inventory:page-size:' + st.tab.k, function () {
                            var next = calculatePageSize(st);
                            if (next !== st.pageSize) { st.pageSize = next; renderWindow(st, true); }
                        }, { replace:true });
                    });
                    st.resizeObserver.observe(st.div);
                }
                bindMultiSelect(st); ensureBatchBar(st);
            });
            ensureAddFab(); hookAutoSort();
            if (typeof window._qjEligibleItems === 'function' && !window._qjEligibleItems.__afkFiltered) {
                var originalQjEligible = window._qjEligibleItems;
                window._qjEligibleItems = function (type) {
                    var st = activeInventoryState();
                    if (st && st.tab.k === type && st.initialReady) return st.filtered.map(function (meta) { return meta.item; }).filter(function (item) { var def = DB.items[item.id]; return item && def && !item.lock && !def.noJunk; });
                    return originalQjEligible.apply(this, arguments);
                };
                window._qjEligibleItems.__afkFiltered = true;
            }
            if (typeof window._qeEligibleItems === 'function' && !window._qeEligibleItems.__afkFiltered) {
                var originalQeEligible = window._qeEligibleItems;
                window._qeEligibleItems = function (type) {
                    var items = originalQeEligible.apply(this, arguments), st = activeInventoryState();
                    if (!st || st.tab.k !== type || !st.initialReady) return items;
                    var visibleIds = filteredUidSet(st);
                    return items.filter(function (item) { return item && item.uid != null && visibleIds.has(String(item.uid)); });
                };
                window._qeEligibleItems.__afkFiltered = true;
            }
            window.__afkVirtualDirtyCurrent = function () {
                var st = activeInventoryState();
                if (st) requestRebuild(st, false);
            };
            AFKRuntime.hooks.after('openModal', 'inventory-item-layer-open', function () {
                var modal = document.getElementById('item-modal'); if (!modal || modal.classList.contains('hidden')) return;
                AFKRuntime.layers.open('inventory-item-modal', { element:modal, content:modal, position:false, outside:false, onClose:function (reason) { if (reason !== 'core' && typeof closeModal === 'function') closeModal(); } });
            }, { frame:false, replace:true });
            AFKRuntime.hooks.after('closeModal', 'inventory-item-layer-close', function () { AFKRuntime.layers.close('inventory-item-modal', 'core'); }, { frame:false, replace:true });
            window._renderInvTabs = function (dirty) {
                dirty = dirty || {};
                var force = !!window.__afkRenderTabsForce;
                var needsRebuild = false;
                TABS.forEach(function (tab) {
                    if (!dirty[tab.k]) return;
                    var st = states[tab.k]; st.div = document.getElementById(tab.id); if (!st.div) return;
                    if (force) { ensureUI(st); ensureHeader(st); }
                    needsRebuild = true;
                });
                if (needsRebuild) requestRebuild(activeInventoryState() || states.wpn, force);
            };
            var originalSwitch = window.switchTab;
            if (typeof originalSwitch === 'function' && !originalSwitch.__afkVirtualV315) {
                window.switchTab = function (name) {
                    var previousInventory = activeInventoryState();
                    var result = originalSwitch.apply(this, arguments);
                    var key = name === 'weapons' ? 'wpn' : (name === 'armors' ? 'arm' : (name === 'items' ? 'item' : ''));
                    setTimeout(function () {
                        syncAddFab();
                        if (!key || !states[key]) {
                            if (previousInventory) {
                                TABS.forEach(function (tab) { clearSelection(states[tab.k]); });
                                flushDeferredAutoSort();
                                if (typeof renderTabs === 'function') renderTabs(true);
                            }
                            return;
                        }
                        var st = states[key]; ensureHeader(st);
                        if (st.stagedRows) scheduleCommit(st);
                        if (st.stale) queueRebuild(st, true); else if (!st.stagedRows) renderWindow(st, true);
                    }, 0);
                    return result;
                };
                window.switchTab.__afkVirtualV315 = true;
            }
            window.__afkVirtualInventoryV315 = true;
            window._renderInvTabs({ wpn: true, arm: true, item: true });
            syncAddFab();
        }
        AFKRuntime.when('inventory:hooks', function () { return typeof window._renderInvTabs === 'function' && typeof window._clearInvTab === 'function' && typeof window.buildQuickHeader === 'function' && typeof DB !== 'undefined'; }, hook);
    }

    // ============================================================
    // ============================================================
    //  🧬 人物六維基礎值修改器
    // ============================================================
    function initCharacterEditorModule() {
        var STATS = [
            { k: 'str', n: '力量' }, { k: 'dex', n: '敏捷' }, { k: 'con', n: '體質' },
            { k: 'int', n: '智力' }, { k: 'wis', n: '精神' }, { k: 'cha', n: '魅力' }
        ];
        var observer = null, syncQueued = false, applyTimer = 0, saveTimer = 0;
        var recalcDirty = false, immediateSavePending = false, lastSaveAt = 0, allocHooked = false;
        var lastPlayerRef = null, lastSlotRef = null, lastRespecState = null;

        function clampStat(v) { return Math.max(0, Math.min(100, Math.floor(Number(v) || 0))); }
        function ready() { return typeof player !== 'undefined' && player && player.base && player.d; }
        function respecActive() { try { return typeof _respec !== 'undefined' && !!_respec; } catch (e) { return false; } }
        function ensurePanacea() {
            if (!player.panacea) player.panacea = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        }
        function panaceaTotal(exceptKey) {
            ensurePanacea();
            return STATS.reduce(function (sum, s) { return sum + (s.k === exceptKey ? 0 : Math.max(0, Math.floor(Number(player.panacea[s.k]) || 0))); }, 0);
        }
        function panaceaMax(key) {
            var naturalWithout = Math.max(0, Math.floor(Number(player.base[key]) || 0)) + Math.max(0, Math.floor(Number(player.alloc && player.alloc[key]) || 0));
            return Math.max(0, Math.min(60 - panaceaTotal(key), 60 - naturalWithout));
        }
        function syncPanaceaUsed() {
            ensurePanacea();
            player.panaceaUsed = STATS.reduce(function (sum, s) { return sum + Math.max(0, Math.floor(Number(player.panacea[s.k]) || 0)); }, 0);
        }

        function syncEditor() {
            syncQueued = false;
            if (!ready()) return;
            var disabled = respecActive();
            ensurePanacea();
            STATS.forEach(function (s) {
                var input = document.querySelector('[data-afk-base-inline="' + s.k + '"]');
                var panaceaInput = document.querySelector('[data-afk-panacea-inline="' + s.k + '"]');
                var finalEl = document.getElementById('dt-' + s.k);
                if (input && document.activeElement !== input) input.value = String(clampStat(player.base[s.k]));
                if (input) { input.disabled = disabled; input.title = disabled ? '配點重置期間暫停外掛能力調整' : s.n + '基礎值（0～100）'; }
                if (panaceaInput && document.activeElement !== panaceaInput) panaceaInput.value = String(Math.max(0, Math.floor(Number(player.panacea[s.k]) || 0)));
                if (panaceaInput) {
                    var max = panaceaMax(s.k);
                    panaceaInput.max = String(max);
                    panaceaInput.disabled = disabled;
                    panaceaInput.title = disabled ? '配點重置期間暫停萬能藥調整' : s.n + '萬能藥加成（目前可設定上限 ' + max + '）';
                }
                if (finalEl) finalEl.title = s.n + '最終值：' + Math.max(0, Math.floor(Number(player.d[s.k]) || 0));
            });
        }

        function queueSync() {
            syncQueued = true;
            AFKRuntime.schedule('character:sync', syncEditor);
        }

        function saveSoon(immediate) {
            if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
            var commit = function () {
                var now = Date.now();
                if (now - lastSaveAt < 80) return;
                lastSaveAt = now;
                if (typeof saveGame === 'function') saveGame();
            };
            if (immediate) commit();
            else saveTimer = setTimeout(commit, 400);
        }

        function flushRecalc() {
            if (applyTimer) { clearTimeout(applyTimer); applyTimer = 0; }
            if (!recalcDirty || !ready()) {
                if (immediateSavePending) saveSoon(true);
                immediateSavePending = false;
                return;
            }
            recalcDirty = false;
            var oldHp = Number(player.hp) || 0, oldMp = Number(player.mp) || 0;
            if (typeof recomputeStats === 'function') {
                recomputeStats();
                player.hp = Math.max(0, Math.min(oldHp, Number(player.mhp) || 0));
                player.mp = Math.max(0, Math.min(oldMp, Number(player.mmp) || 0));
                if (typeof applyElfBorder === 'function') applyElfBorder();
                if (typeof updateUI === 'function') updateUI();
                if (typeof applyDollCursor === 'function') applyDollCursor();
            } else if (typeof calcStats === 'function') {
                // 舊版遊戲的 calcStats 已包含完整 UI 刷新，不再額外重複呼叫 updateUI。
                calcStats();
                player.hp = Math.max(0, Math.min(oldHp, Number(player.mhp) || 0));
                player.mp = Math.max(0, Math.min(oldMp, Number(player.mmp) || 0));
            }
            saveSoon(immediateSavePending);
            immediateSavePending = false;
            queueSync();
        }

        function queueRecalc(immediate) {
            if (applyTimer) { clearTimeout(applyTimer); applyTimer = 0; }
            if (immediate) flushRecalc();
            else applyTimer = setTimeout(flushRecalc, 200);
        }

        function applyStat(input, immediateSave) {
            if (!ready() || !input || respecActive() || input.value === '') return;
            var key = input.getAttribute('data-afk-base-inline');
            if (!key || !Object.prototype.hasOwnProperty.call(player.base, key)) return;
            var value = clampStat(input.value);
            input.value = String(value);
            if (player.base[key] !== value) { player.base[key] = value; recalcDirty = true; }
            immediateSavePending = immediateSavePending || !!immediateSave;
            queueRecalc(!!immediateSave);
        }

        function applyPanacea(input, immediateSave) {
            if (!ready() || !input || respecActive() || input.value === '') return;
            ensurePanacea();
            var key = input.getAttribute('data-afk-panacea-inline');
            if (!key || !Object.prototype.hasOwnProperty.call(player.panacea, key)) return;
            var value = Math.max(0, Math.min(panaceaMax(key), Math.floor(Number(input.value) || 0)));
            input.value = String(value);
            input.max = String(panaceaMax(key));
            if (player.panacea[key] !== value) {
                player.panacea[key] = value;
                syncPanaceaUsed();
                recalcDirty = true;
            }
            immediateSavePending = immediateSavePending || !!immediateSave;
            queueRecalc(!!immediateSave);
        }

        function refreshAllocDraft() {
            if (!respecActive()) return;
            try {
                var base = createBase[player.cls];
                STATS.forEach(function (s) {
                    var el = document.getElementById('dt-' + s.k);
                    if (el) el.textContent = String((base[s.k] || 0) + (_respec.draft[s.k] || 0));
                });
                var label = document.getElementById('alloc-bar-label');
                if (label) label.textContent = '剩餘配點：' + (typeof respecPtsLeft === 'function' ? respecPtsLeft() : 0);
            } catch (e) {}
        }

        function hookAlloc() {
            if (allocHooked) return;
            if (typeof window.adjAlloc !== 'function' || typeof window.naturalStat !== 'function') return;
            window.adjAlloc = function (stat, dir) {
                if (!ready() || !player.alloc || !Object.prototype.hasOwnProperty.call(player.alloc, stat)) return;
                if (respecActive()) {
                    var base = createBase[player.cls];
                    if (dir > 0) {
                        if (respecPtsLeft() > 0 && (base[stat] + _respec.draft[stat]) < 60) _respec.draft[stat]++;
                    } else if (_respec.draft[stat] > 0) _respec.draft[stat]--;
                    refreshAllocDraft();
                    return;
                }
                if (dir <= 0 || (player.bonus || 0) <= 0 || naturalStat(stat) >= 60) return;
                player.alloc[stat]++;
                player.bonus--;
                var label = document.getElementById('alloc-bar-label');
                if (label) label.textContent = '升級點數：' + player.bonus;
                recalcDirty = true;
                queueRecalc(false);
            };
            window.adjAlloc.__afkV312 = true;
            allocHooked = true;
        }

        function inject() {
            var tab = document.getElementById('tab-stats');
            if (!tab) return;
            var legacy = document.getElementById('afk-stat-editor');
            if (legacy) legacy.remove();
            STATS.forEach(function (s) {
                var finalEl = document.getElementById('dt-' + s.k);
                if (!finalEl || document.querySelector('[data-afk-stat-inline="' + s.k + '"]')) return;
                var holder = document.createElement('span');
                holder.className = 'afk-stat-inline';
                holder.setAttribute('data-afk-stat-inline', s.k);
                holder.innerHTML = '<label><small>基礎</small><input type="number" min="0" max="100" step="1" inputmode="numeric" data-afk-base-inline="' + s.k + '"></label>' +
                    '<label><small>萬能藥</small><input type="number" min="0" max="60" step="1" inputmode="numeric" data-afk-panacea-inline="' + s.k + '"></label>';
                finalEl.parentNode.insertBefore(holder, finalEl);
            });
            if (!observer && typeof MutationObserver === 'function') {
                observer = new MutationObserver(function () {
                    var missing = STATS.some(function (s) { return !document.querySelector('[data-afk-stat-inline="' + s.k + '"]'); });
                    if (missing) inject(); else queueSync();
                });
                observer.observe(tab, { childList: true });
            }
            syncEditor();
        }

        document.addEventListener('input', function (e) {
            if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-afk-base-inline')) applyStat(e.target, false);
            else if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-afk-panacea-inline')) applyPanacea(e.target, false);
        }, true);
        document.addEventListener('change', function (e) {
            if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-afk-base-inline')) applyStat(e.target, false);
            else if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-afk-panacea-inline')) applyPanacea(e.target, false);
        }, true);
        document.addEventListener('focusout', function (e) {
            if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-afk-base-inline')) applyStat(e.target, true);
            else if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-afk-panacea-inline')) applyPanacea(e.target, true);
        }, true);
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' || !e.target || !e.target.hasAttribute) return;
            if (e.target.hasAttribute('data-afk-base-inline')) applyStat(e.target, true);
            else if (e.target.hasAttribute('data-afk-panacea-inline')) applyPanacea(e.target, true);
            else return;
            e.preventDefault();
            if (typeof e.target.blur === 'function') e.target.blur();
        }, true);
        document.addEventListener('click', function (e) {
            var tabBtn = e.target && e.target.closest ? e.target.closest('[onclick*="switchTab"]') : null;
            if (tabBtn && /switchTab\(['"]stats['"]/.test(tabBtn.getAttribute('onclick') || '')) AFKRuntime.schedule('character:tab-sync', syncEditor);
        }, true);

        AFKRuntime.when('character:panel', function () { return document.getElementById('tab-stats'); }, inject);
        AFKRuntime.when('character:allocation', function () { return typeof window.adjAlloc === 'function' && typeof window.naturalStat === 'function'; }, hookAlloc);
        AFKRuntime.every('character:state-sync', function () {
            if (!ready()) return;
            var slot = typeof currentSlot !== 'undefined' ? currentSlot : null;
            var respec = respecActive();
            if (player !== lastPlayerRef || slot !== lastSlotRef || respec !== lastRespecState) {
                lastPlayerRef = player; lastSlotRef = slot; lastRespecState = respec; queueSync();
            }
        }, 500);
    }

    // ============================================================
    //  ✨ 技能點亮開關
    // ============================================================
    function initSkillToggleModule() {
        var decorateQueued = false, hooked = false;

        function setLearned(id, on) {
            if (!id || !DB.skills[id] || (player.grantedSkills || []).indexOf(id) >= 0) return;
            if (!Array.isArray(player.skills)) player.skills = [];
            var has = player.skills.indexOf(id) >= 0;
            if (on && !has) player.skills.push(id);
            if (!on && has) {
                player.skills = player.skills.filter(function (sid) { return sid !== id; });
                if (player.buffs && Object.prototype.hasOwnProperty.call(player.buffs, id)) player.buffs[id] = 0;
                if (player.manualCd && Object.prototype.hasOwnProperty.call(player.manualCd, id)) player.manualCd[id] = 0;
                if (player.config && player.config.autoBuffSkills) delete player.config.autoBuffSkills[id];
                ['sel-atk-skill', 'sel-heal-skill', 'sel-convert-skill'].forEach(function (sid) { var sel = document.getElementById(sid); if (sel && sel.value === id) sel.value = ''; });
            }
        }
        function applyBulk(on, element) {
            var ids = Array.from(document.querySelectorAll('#tab-skill .classic-skill-cell[data-tip-skill]')).map(function (cell) { return cell.getAttribute('data-tip-skill'); });
            ids.forEach(function (id) {
                var sk = DB.skills[id]; if (!sk) return;
                if (player.cls === 'elf' && element && sk.reqEle !== element) return;
                setLearned(id, on);
            });
            if (typeof calcStats === 'function') calcStats();
            if (typeof renderSkillSelects === 'function') renderSkillSelects();
            if (typeof refreshClassicSkillBookOnly === 'function') refreshClassicSkillBookOnly(); else if (typeof renderTabs === 'function') renderTabs();
            if (typeof saveGame === 'function') saveGame();
            queueDecorate();
        }
        function decorateBulk() {
            var tab = document.getElementById('tab-skill');
            var win = tab && tab.querySelector('.classic-skill-window');
            if (!tab || !win) return;
            var old = tab.querySelector('.afk-skill-bulk');
            if (old && old.parentNode === tab && old.nextElementSibling === win) return;
            if (old) old.remove();
            var bar = document.createElement('div'); bar.className = 'afk-skill-bulk';
            var elementHtml = '';
            try {
                if (player.cls === 'elf' && classicSkillBookState.mode === 'class') elementHtml = '<select class="afk-skill-element"><option value="">目前分頁全部</option><option value="earth">地屬性</option><option value="water">水屬性</option><option value="fire">火屬性</option><option value="wind">風屬性</option></select>';
            } catch (e) {}
            bar.innerHTML = '<span><i>✨</i><b>本頁技能</b><small>批次調整目前分頁</small></span>' + elementHtml + '<button type="button" class="afk-skill-bulk-on" data-afk-skill-bulk="1"><i>✓</i> 全部點亮</button><button type="button" class="afk-skill-bulk-off" data-afk-skill-bulk="0"><i>○</i> 全部關閉</button>';
            tab.insertBefore(bar, win);
            bar.addEventListener('click', function (e) {
                var btn = e.target.closest && e.target.closest('[data-afk-skill-bulk]'); if (!btn) return;
                e.preventDefault(); e.stopPropagation();
                var select = bar.querySelector('.afk-skill-element'); applyBulk(btn.dataset.afkSkillBulk === '1', select ? select.value : '');
            });
        }

        function decorateSkills() {
            decorateQueued = false;
            if (typeof player === 'undefined' || !player) return;
            var granted = player.grantedSkills || [];
            Array.from(document.querySelectorAll('#tab-skill .classic-skill-cell[data-tip-skill]')).forEach(function (cell) {
                var id = cell.getAttribute('data-tip-skill');
                if (!id) return;
                var learned = Array.isArray(player.skills) && player.skills.indexOf(id) >= 0;
                var isGranted = granted.indexOf(id) >= 0;
                var toggle = cell.querySelector('.afk-skill-toggle');
                if (!toggle || toggle.tagName !== 'BUTTON') {
                    if (toggle) toggle.remove();
                    toggle = document.createElement('button');
                    toggle.type = 'button';
                    toggle.className = 'afk-skill-toggle';
                    toggle.setAttribute('role', 'switch');
                    toggle.dataset.afkSkill = id;
                    cell.appendChild(toggle);
                }
                toggle.classList.toggle('on', learned);
                toggle.classList.toggle('granted', isGranted);
                toggle.setAttribute('aria-checked', learned ? 'true' : 'false');
                toggle.title = isGranted ? '此技能由裝備授予，無法關閉' : (learned ? '關閉技能' : '點亮技能');
                var label = isGranted ? '◆ 裝備' : (learned ? '✓ 點亮' : '○ 關閉');
                if (toggle.textContent !== label) toggle.textContent = label;
            });
            decorateBulk();
        }

        function queueDecorate() {
            decorateQueued = true;
            AFKRuntime.schedule('skills:decorate', decorateSkills);
        }

        function hookRender() {
            if (hooked) return;
            AFKRuntime.hooks.after('renderClassicSkillBook', 'skill-toggle', queueDecorate);
            hooked = true;
            queueDecorate();
        }

        document.addEventListener('click', function (e) {
            var toggle = e.target && e.target.closest ? e.target.closest('.afk-skill-toggle[data-afk-skill]') : null;
            if (!toggle) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (typeof player === 'undefined' || !player) return;
            var id = toggle.dataset.afkSkill;
            if (!id || typeof DB === 'undefined' || !DB.skills || !DB.skills[id]) return;
            if ((player.grantedSkills || []).indexOf(id) >= 0) return;
            var idx = Array.isArray(player.skills) ? player.skills.indexOf(id) : -1;
            setLearned(id, idx < 0);
            if (typeof calcStats === 'function') calcStats();
            if (typeof renderSkillSelects === 'function') renderSkillSelects();
            if (typeof renderTabs === 'function') renderTabs();
            if (typeof refreshClassicSkillBookOnly === 'function') refreshClassicSkillBookOnly();
            if (typeof saveGame === 'function') saveGame();
            queueDecorate();
        }, true);

        function observe() {
            var tab = document.getElementById('tab-skill');
            if (!tab) return;
            if (typeof MutationObserver === 'function') {
                new MutationObserver(queueDecorate).observe(tab, { childList: true, subtree: true });
            }
            hookRender();
            queueDecorate();
        }
        AFKRuntime.when('skills:panel', function () { return document.getElementById('tab-skill') && typeof window.renderClassicSkillBook === 'function'; }, observe);
    }

    // ============================================================
    //  🔧 安全裝備屬性修改器
    // ============================================================
    function initEquipmentEditorModule() {
        var current = null, hooked = false;
        var SLOT_LABELS = { wpn:'武器', offwpn:'副手武器', shield:'副手', helm:'頭盔', armor:'盔甲', tshirt:'T恤', cloak:'斗篷', gloves:'手套', shin:'脛甲', boots:'長靴', amulet:'項鍊', belt:'腰帶', pet:'寵物裝備', doll:'魔法娃娃', arrow:'箭矢', ear1:'耳環 1', ear2:'耳環 2', ring1:'戒指 1', ring2:'戒指 2', ring3:'戒指 3', ring4:'戒指 4', rem_claw:'席琳遺骸・之爪', rem_eye:'席琳遺骸・之眼', rem_blood:'席琳遺骸・之血', rem_flesh:'席琳遺骸・之肉', rem_heart:'席琳遺骸・之心', rem_bone:'席琳遺骸・之骨', rem_fang:'席琳遺骸・之牙', rem_scale:'席琳遺骸・之鱗' };
        var ATTRS = [
            ['', '無'], ['fire1', '火之'], ['water1', '水之'], ['wind1', '風之'], ['earth1', '地之'],
            ['fire3', '爆炎'], ['water3', '海嘯'], ['wind3', '暴風'], ['earth3', '崩裂'],
            ['fire5', '火靈'], ['water5', '水靈'], ['wind5', '風靈'], ['earth5', '地靈']
        ];

        function isEquipment(d) { return !!d && ((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc'); }
        function findTarget(uidValue, isEq, slot) {
            if (typeof player === 'undefined' || !player) return null;
            if (isEq) {
                if (slot && player.eq && player.eq[slot] && String(player.eq[slot].uid) === String(uidValue)) return { item: player.eq[slot], slot: slot };
                for (var k in player.eq) if (player.eq[k] && String(player.eq[k].uid) === String(uidValue)) return { item: player.eq[k], slot: k };
                return null;
            }
            var item = (player.inv || []).find(function (it) { return String(it.uid) === String(uidValue); });
            return item ? { item: item, slot: null } : null;
        }
        function option(value, label, selected) {
            return '<option value="' + value + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + label + '</option>';
        }
        function isRemains(d) { return !!(d && d.remains); }
        function isCustomShin(d) { return !!(d && d.slot === 'shin'); }
        function canSetEffect(d) {
            if (isRemains(d)) return true;
            if (isCustomShin(d)) return false;
            try { return typeof sherineSetEligible === 'function' && sherineSetEligible(d); } catch (e) { return false; }
        }
        function setEffects() {
            try { return typeof SHERINE_EFFECTS !== 'undefined' && Array.isArray(SHERINE_EFFECTS) ? SHERINE_EFFECTS.slice() : []; }
            catch (e) { return []; }
        }

        function appendEditorButton(item, isEq, slot) {
            var d = typeof DB !== 'undefined' && DB.items ? DB.items[item.id] : null;
            var actions = document.getElementById('modal-actions');
            if (!actions || !isEquipment(d) || actions.querySelector('[data-afk-equip-edit]')) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'col-span-2 w-full btn afk-equip-edit-btn';
            btn.dataset.afkEquipEdit = '1';
            btn.dataset.uid = String(item.uid);
            btn.dataset.eq = isEq ? '1' : '0';
            btn.dataset.slot = slot || '';
            btn.textContent = '🔧 調整裝備';
            actions.appendChild(btn);
        }

        function openEditor(uidValue, isEq, slot) {
            var found = findTarget(uidValue, isEq, slot);
            if (!found) return;
            var item = found.item, d = DB.items[item.id];
            if (!isEquipment(d)) return;
            current = { uid: item.uid, isEq: !!isEq, slot: found.slot };
            var relic = typeof isRelic === 'function' ? isRelic(d) : !!d.relic;
            var remains = isRemains(d), customShin = isCustomShin(d);
            var canEnhance = !remains && !d.isArrow && (customShin || (!relic && !d.noEnhance));
            var canAffix = !remains && !d.isArrow && (customShin || !relic);
            var cap = canEnhance ? (customShin ? 15 : (typeof enhanceCap === 'function' ? enhanceCap(d) : 0)) : 0;
            var attrOptions = ATTRS.map(function (a) { return option(a[0], a[1], item.attr || ''); }).join('');
            var effects = setEffects();
            var effectAllowed = canSetEffect(d) && effects.length > 0;
            var currentEffect = item.seteff ? String(item.seteff).slice(0, 2) : '';
            var selectedEffect = effects.indexOf(currentEffect) >= 0 ? currentEffect : (remains ? effects[0] : '');
            var effectOptions = (remains ? '' : option('', '無', selectedEffect)) + effects.map(function (name) { return option(name, name, selectedEffect); }).join('');
            var help = remains
                ? '席琳遺骸只能調整共鳴效果；強化與一般詞綴固定停用。'
                : (customShin ? '外掛脛甲自訂：強化上限 +15，可調整祝福、遠古與元素詞綴。'
                    : (relic ? '遺物不開放強化與詞綴調整。' : (d.noEnhance ? '此裝備不可調整強化值。' : '強化上限 +' + cap + '。')));
            if (!remains && effectAllowed) help += ' 一般裝備的席琳舊詞綴只供顯示與拆分，不直接計入套裝效果。';
            document.getElementById('modal-item-name').innerHTML = '🔧 調整 ' + getItemFullName(item);
            document.getElementById('modal-item-desc').innerHTML =
                '<div class="afk-equip-editor">' +
                '<label><span>強化值</span><input id="afk-eq-en" type="number" min="0" max="' + cap + '" value="' + (Number(item.en) || 0) + '"' + (canEnhance ? '' : ' disabled') + '></label>' +
                '<label><span>祝福狀態</span><select id="afk-eq-bless"' + (canAffix ? '' : ' disabled') + '>' +
                    option('', '普通', item.bless || '') + option('bless', '祝福', item.bless === true ? 'bless' : item.bless) + option('cursed', '詛咒', item.bless || '') + '</select></label>' +
                '<label><span>遠古詞綴</span><select id="afk-eq-anc"' + (canAffix ? '' : ' disabled') + '>' +
                    option('', '無', item.anc || '') + option('ancient', '遠古', item.anc === true ? 'ancient' : item.anc) +
                    option('eternal', '永恆', item.anc || '') + option('immortal', '不朽', item.anc || '') + option('primordial', '太初', item.anc || '') + '</select></label>' +
                '<label><span>元素詞綴</span><select id="afk-eq-attr"' + (canAffix ? '' : ' disabled') + '>' + attrOptions + '</select></label>' +
                '<label><span>席琳效果</span><select id="afk-eq-seteff"' + (effectAllowed ? '' : ' disabled') + '>' + effectOptions + '</select></label>' +
                '<small>' + help + '</small>' +
                '</div>';
            document.getElementById('modal-actions').innerHTML =
                (current.isEq && current.slot ? '<button type="button" class="col-span-2 w-full btn afk-equip-replace-btn" data-afk-equip-replace="1">＋ 更換此欄裝備</button>' : '') +
                '<button type="button" class="col-span-2 w-full btn afk-editor-apply" data-afk-equip-apply="1">套用調整</button>' +
                '<button type="button" class="col-span-2 w-full btn bg-slate-700" data-afk-equip-cancel="1">返回物品</button>';
            document.getElementById('item-modal').classList.remove('hidden');
        }

        function reopen() {
            if (!current) return;
            var found = findTarget(current.uid, current.isEq, current.slot);
            if (found && typeof window.openModal === 'function') window.openModal(found.item, current.isEq, found.slot);
        }

        function applyEditor() {
            if (!current) return;
            var found = findTarget(current.uid, current.isEq, current.slot);
            if (!found) return;
            var item = found.item, d = DB.items[item.id];
            var relic = typeof isRelic === 'function' ? isRelic(d) : !!d.relic;
            var remains = isRemains(d), customShin = isCustomShin(d);
            var canEnhance = !remains && !d.isArrow && (customShin || (!relic && !d.noEnhance));
            var canAffix = !remains && !d.isArrow && (customShin || !relic);
            var oldSig = typeof itemSig === 'function' ? itemSig(item) : '';
            var didSplit = false;
            var oldHp = typeof player.hp === 'number' ? player.hp : null;
            var oldMp = typeof player.mp === 'number' ? player.mp : null;

            if (!current.isEq && (Number(item.cnt) || 1) > 1) {
                didSplit = true;
                item.cnt = (Number(item.cnt) || 1) - 1;
                var clone = Object.assign({}, item);
                clone.uid = typeof uid === 'function' ? uid() : ('afk-' + Date.now() + '-' + Math.random().toString(36).slice(2));
                clone.cnt = 1;
                clone.junk = false;
                delete clone.junkSince;
                player.inv.push(clone);
                item = clone;
                current.uid = clone.uid;
            }

            if (canEnhance) {
                var cap = customShin ? 15 : (typeof enhanceCap === 'function' ? enhanceCap(d) : 0);
                item.en = Math.max(0, Math.min(cap, Math.floor(Number(document.getElementById('afk-eq-en').value) || 0)));
            }
            if (canAffix) {
                var bless = document.getElementById('afk-eq-bless').value;
                item.bless = bless === 'bless' ? true : (bless === 'cursed' ? 'cursed' : false);
                var anc = document.getElementById('afk-eq-anc').value;
                item.anc = anc === 'ancient' ? true : (anc || false);
                var attr = document.getElementById('afk-eq-attr').value;
                item.attr = ATTRS.some(function (a) { return a[0] === attr; }) && attr ? attr : false;
            }
            var setSelect = document.getElementById('afk-eq-seteff');
            if (canSetEffect(d) && setSelect && !setSelect.disabled) {
                var effects = setEffects();
                item.seteff = effects.indexOf(setSelect.value) >= 0 ? setSelect.value : (remains ? (effects[0] || false) : false);
            }
            if (remains) { item.en = 0; item.bless = false; item.anc = false; item.attr = false; }
            item.junk = false;
            delete item.junkSince;
            if (player.junkPrefs) {
                if (oldSig && !didSplit) delete player.junkPrefs[oldSig];
                if (typeof itemSig === 'function') delete player.junkPrefs[itemSig(item)];
            }
            if (typeof calcStats === 'function') calcStats();
            if (oldHp != null && typeof player.mhp === 'number') player.hp = Math.min(oldHp, player.mhp);
            if (oldMp != null && typeof player.mmp === 'number') player.mp = Math.min(oldMp, player.mmp);
            if (typeof renderTabs === 'function') renderTabs(true);
            if (typeof updateUI === 'function') updateUI();
            if (typeof saveGame === 'function') saveGame();
            reopen();
        }

        document.addEventListener('click', function (e) {
            var edit = e.target && e.target.closest ? e.target.closest('[data-afk-equip-edit]') : null;
            if (edit) {
                e.preventDefault();
                openEditor(edit.dataset.uid, edit.dataset.eq === '1', edit.dataset.slot || null);
                return;
            }
            if (e.target && e.target.closest && e.target.closest('[data-afk-equip-apply]')) {
                e.preventDefault();
                applyEditor();
                return;
            }
            if (e.target && e.target.closest && e.target.closest('[data-afk-equip-replace]')) {
                e.preventDefault();
                if (current && current.isEq && current.slot && typeof window.__afkOpenEquipmentPicker === 'function') {
                    var slot = current.slot, label = SLOT_LABELS[slot] || '裝備';
                    if (typeof closeModal === 'function') closeModal();
                    window.__afkOpenEquipmentPicker(slot, label, true);
                }
                return;
            }
            if (e.target && e.target.closest && e.target.closest('[data-afk-equip-cancel]')) {
                e.preventDefault();
                reopen();
            }
        }, true);

        function hookOpenModal() {
            if (hooked) return;
            AFKRuntime.hooks.after('openModal', 'equipment-editor', function (result, args) { appendEditorButton(args[0], !!args[1], args[2] || null); }, { frame:false });
            hooked = true;
        }
        AFKRuntime.when('equipment:modal', function () { return typeof window.openModal === 'function'; }, hookOpenModal);
    }

    // ============================================================
    //  🔢 背包物品數量修改
    // ============================================================
    function initItemQuantityModule() {
        var hooked = false;
        var MAX_NORMAL = 999999999;

        function findItem(uidValue) {
            if (typeof player === 'undefined' || !player || !Array.isArray(player.inv)) return null;
            return player.inv.find(function (item) { return String(item.uid) === String(uidValue); }) || null;
        }
        function quantityMax(d, currentItem) {
            if (!d) return MAX_NORMAL;
            var limit = d.unique ? 1 : (d.maxHold != null ? Math.max(0, Math.floor(Number(d.maxHold) || 0)) : MAX_NORMAL);
            if (limit !== MAX_NORMAL && typeof player !== 'undefined' && player && Array.isArray(player.inv)) {
                var heldByOthers = player.inv.reduce(function (sum, entry) {
                    return sum + (entry !== currentItem && entry.id === currentItem.id ? Math.max(0, Math.floor(Number(entry.cnt) || 0)) : 0);
                }, 0);
                return Math.max(0, limit - heldByOthers);
            }
            return limit;
        }
        function appendQuantityEditor(item, isEq) {
            if (isEq || !item || item.id === 'candle') return;
            var actions = document.getElementById('modal-actions');
            var d = typeof DB !== 'undefined' && DB.items ? DB.items[item.id] : null;
            if (!actions || !d || actions.querySelector('[data-afk-qty-editor]')) return;
            var max = quantityMax(d, item), current = Math.max(1, Math.floor(Number(item.cnt) || 1));
            var editor = document.createElement('div');
            editor.className = 'afk-qty-editor';
            editor.dataset.afkQtyEditor = '1';
            editor.innerHTML = '<label><span>物品數量</span><input type="number" min="0" max="' + max + '" step="1" inputmode="numeric" value="' + current + '" data-afk-qty-input="' + String(item.uid) + '"></label>' +
                '<button type="button" class="btn afk-qty-apply" data-afk-qty-apply="' + String(item.uid) + '">套用數量</button>' +
                '<small>可設定 0～' + max.toLocaleString() + '；設為 0 會移除此堆疊。</small>';
            actions.appendChild(editor);
        }
        function applyQuantity(uidValue) {
            var item = findItem(uidValue);
            if (!item) { if (typeof closeModal === 'function') closeModal(); return; }
            var d = typeof DB !== 'undefined' && DB.items ? DB.items[item.id] : null;
            if (!d) return;
            var input = document.querySelector('[data-afk-qty-input="' + String(uidValue) + '"]');
            if (!input) return;
            var max = quantityMax(d, item);
            var next = Math.max(0, Math.min(max, Math.floor(Number(input.value) || 0)));
            input.value = String(next);
            if (next === 0 && (item.lock || d.unique || d.noSell)) {
                var warning = '此物品' + (item.lock ? '已鎖定' : (d.unique ? '屬於唯一物品' : '不可販賣')) + '，確定要從背包移除嗎？';
                if (typeof window.confirm === 'function' && !window.confirm(warning)) { input.value = String(Math.max(1, Math.floor(Number(item.cnt) || 1))); return; }
            }
            if (next === 0) {
                var index = player.inv.indexOf(item);
                if (index >= 0) player.inv.splice(index, 1);
            } else {
                item.cnt = next;
            }
            if (typeof saveGame === 'function') saveGame();
            if (typeof renderTabs === 'function') renderTabs();
            if (next === 0) {
                if (typeof closeModal === 'function') closeModal();
                else { var modal = document.getElementById('item-modal'); if (modal) modal.classList.add('hidden'); }
            } else if (typeof window.openModal === 'function') {
                var current = findItem(uidValue);
                if (current) window.openModal(current, false);
            }
        }
        document.addEventListener('click', function (e) {
            var button = e.target && e.target.closest ? e.target.closest('[data-afk-qty-apply]') : null;
            if (!button) return;
            e.preventDefault(); e.stopPropagation();
            applyQuantity(button.getAttribute('data-afk-qty-apply'));
        }, true);
        function hookOpenModal() {
            if (hooked) return;
            AFKRuntime.hooks.after('openModal', 'item-quantity', function (result, args) { appendQuantityEditor(args[0], !!args[1]); }, { frame:false });
            hooked = true;
        }
        AFKRuntime.when('quantity:modal', function () { return typeof window.openModal === 'function'; }, hookOpenModal);
    }

    // ============================================================
    //  🧰 空裝備欄精確選擇器
    // ============================================================
    function initEmptyEquipmentPickerModule() {
        var panel = null, activeSlot = '', candidates = [], scanToken = 0, allowReplace = false;
        var LABEL_SLOT = { '武器':'wpn', '副手武器':'offwpn', '副手':'shield', '頭盔':'helm', '盔甲':'armor', 'T恤':'tshirt', '斗篷':'cloak', '手套':'gloves', '脛甲':'shin', '長靴':'boots', '項鍊':'amulet', '腰帶':'belt', '寵物裝備':'pet', '魔法娃娃':'doll', '箭矢':'arrow', '之爪':'rem_claw', '之眼':'rem_eye', '之血':'rem_blood', '之肉':'rem_flesh', '之心':'rem_heart', '之骨':'rem_bone', '之牙':'rem_fang', '之鱗':'rem_scale' };

        function requiredLevel(slot) { return slot === 'ring3' ? 55 : (slot === 'ring4' ? 65 : (slot === 'ear2' ? 50 : 0)); }
        function itemDef(item) { try { return DB.items[item.id] || null; } catch (e) { return null; } }
        function plainItemName(item, d) {
            if (!d) return item && item.id ? String(item.id) : '';
            var full = d.n || item.id || '';
            try { if (typeof getItemFullName === 'function') full = getItemFullName(item); } catch (e) {}
            if (typeof full !== 'string' || full.indexOf('<') < 0) return String(full || d.n || item.id || '');
            var box = document.createElement('span'); box.innerHTML = full;
            return (box.textContent || d.n || item.id || '').replace(/\s+/g, ' ').trim();
        }
        function accepts(slot, item) {
            var d = itemDef(item); if (!d || !item || (requiredLevel(slot) && player.lv < requiredLevel(slot))) return false;
            try { if (typeof checkCanEquip === 'function' && !checkCanEquip(item)) return false; } catch (e) { return false; }
            if (slot === 'wpn') return d.type === 'wpn' && !d.isArrow;
            if (slot === 'offwpn') {
                try { return d.type === 'wpn' && !d.isArrow && warriorDualWieldWpnOk(item.id) && dualWieldOffhandOk(); } catch (e) { return false; }
            }
            if (slot === 'arrow') return !!d.isArrow;
            if (slot.indexOf('ring') === 0) return d.slot === 'ring';
            if (slot.indexOf('ear') === 0) return d.slot === 'ear';
            return d.slot === slot;
        }
        function closePicker() {
            scanToken++;
            if (AFKRuntime.layers.close('equipment-picker', 'button')) return;
            if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
            panel = null; activeSlot = ''; candidates = []; allowReplace = false;
        }
        function showMessage(text) {
            if (!panel) return;
            var list = panel.querySelector('.afk-equip-pick-list');
            if (list) { list.replaceChildren(); var msg = document.createElement('div'); msg.className = 'afk-equip-pick-empty'; msg.textContent = text; list.appendChild(msg); }
        }
        function inheritEquipmentValues(target, source, d, slot) {
            if (!target || !source || !d) return;
            var remains = !!d.remains, customShin = d.slot === 'shin';
            var relic = false; try { relic = typeof isRelic === 'function' ? isRelic(d) : !!d.relic; } catch (e) { relic = !!d.relic; }
            var canEnhance = !remains && !d.isArrow && (customShin || (!relic && !d.noEnhance));
            var canAffix = !remains && !d.isArrow && (customShin || !relic);
            if (canEnhance) {
                var cap = customShin ? 15 : (typeof enhanceCap === 'function' ? enhanceCap(d) : 0);
                target.en = Math.max(0, Math.min(cap, Math.floor(Number(source.en) || 0)));
            } else target.en = 0;
            if (canAffix) {
                target.bless = source.bless === true ? true : (source.bless === 'cursed' ? 'cursed' : false);
                target.anc = source.anc || false;
                target.attr = source.attr || false;
            } else { target.bless = false; target.anc = false; target.attr = false; }
            var effects = []; try { effects = Array.isArray(SHERINE_EFFECTS) ? SHERINE_EFFECTS.slice() : Object.keys(SHERINE_EFFECTS || {}); } catch (e) {}
            if (remains) target.seteff = effects.indexOf(source.seteff) >= 0 ? source.seteff : (effects[0] || '紅獅');
            else {
                var canSet = false; try { canSet = !customShin && typeof sherineSetEligible === 'function' && sherineSetEligible(d); } catch (e) {}
                target.seteff = canSet && effects.indexOf(source.seteff) >= 0 ? source.seteff : false;
            }
        }
        function exactEquip(slot, item) {
            if (!player || !player.eq || (player.eq[slot] && !allowReplace) || !accepts(slot, item)) return;
            var d = itemDef(item), fromCatalog = !!item._afkCatalog;
            if (!d) return;
            if (d.unique && Object.keys(player.eq).some(function (key) { var e = player.eq[key]; return key !== slot && e && e.id === item.id; })) { if (typeof logSys === 'function') logSys('此物品具有唯一限制，身上最多只能裝備一件。'); return; }
            if (slot.indexOf('ear') === 0) {
                var otherEar = slot === 'ear1' ? player.eq.ear2 : player.eq.ear1;
                if (otherEar && itemDef(otherEar) && itemDef(otherEar).n === d.n) { if (typeof logSys === 'function') logSys('無法同時裝備兩個名字相同的耳環。'); return; }
            }
            if (slot.indexOf('ring') === 0) {
                var sameRings = ['ring1','ring2','ring3','ring4'].filter(function (key) { return key !== slot && player.eq[key] && player.eq[key].id === item.id; }).length;
                if (sameRings >= 2) { if (typeof logSys === 'function') logSys('相同戒指最多只能同時裝備兩顆。'); return; }
            }
            var inheritedFrom = allowReplace && player.eq[slot] ? Object.assign({}, player.eq[slot]) : null;
            try {
                if (player.eq[slot]) {
                    if (typeof isEquipCursed === 'function' && isEquipCursed(slot)) { if (typeof logSys === 'function') logSys('原本的裝備受到詛咒，無法替換。'); return; }
                }
                if (slot === 'wpn' && typeof effTwoHanded === 'function' && effTwoHanded(d, item.id) && player.eq.shield && !itemDef(player.eq.shield).armguard) {
                    if (typeof isEquipCursed === 'function' && isEquipCursed('shield')) { if (typeof logSys === 'function') logSys('被詛咒的盾牌無法卸下。'); return; }
                    if (typeof returnEquipToInv === 'function') returnEquipToInv('shield');
                } else if (slot === 'shield' && !d.armguard && player.eq.wpn && typeof effTwoHanded === 'function' && effTwoHanded(itemDef(player.eq.wpn), player.eq.wpn.id)) {
                    if (typeof isEquipCursed === 'function' && isEquipCursed('wpn')) { if (typeof logSys === 'function') logSys('被詛咒的雙手武器無法卸下。'); return; }
                    if (typeof returnEquipToInv === 'function') returnEquipToInv('wpn');
                }
                if (player.eq[slot] && typeof returnEquipToInv === 'function') returnEquipToInv(slot);
            } catch (e) {}
            if (fromCatalog) {
                item = { id: item.id, cnt: 1, uid: typeof uid === 'function' ? uid() : Date.now() + Math.random(), en: 0, bless: false, anc: false, attr: false, seteff: d.remains ? '紅獅' : false, lock: false, junk: false };
                player.inv.push(item);
            }
            var invItem = player.inv.find(function (x) { return x && x.uid === item.uid; });
            if (!invItem) return;
            var stack = slot === 'arrow';
            var equipped = Object.assign({}, invItem, { cnt: stack ? invItem.cnt : 1, uid: stack ? invItem.uid : (typeof uid === 'function' ? uid() : Date.now() + Math.random()) });
            if (inheritedFrom) inheritEquipmentValues(equipped, inheritedFrom, d, slot);
            if (stack) player.inv = player.inv.filter(function (x) { return x.uid !== invItem.uid; });
            else { invItem.cnt = (Number(invItem.cnt) || 1) - 1; if (invItem.cnt <= 0) player.inv = player.inv.filter(function (x) { return x.uid !== invItem.uid; }); }
            player.eq[slot] = equipped;
            try {
                if (d.relic && typeof registerRelicObtained === 'function') registerRelicObtained(item.id);
                else if (typeof registerEquipObtained === 'function') registerEquipObtained(item.id);
            } catch (e) {}
            try { if (typeof syncShahaArrow === 'function') syncShahaArrow(); if (typeof syncDualWield === 'function') syncDualWield(); } catch (e) {}
            var oldHp = player.hp, oldMp = player.mp;
            if (typeof calcStats === 'function') calcStats();
            if (Number.isFinite(oldHp)) player.hp = Math.min(oldHp, player.mhp || oldHp);
            if (Number.isFinite(oldMp)) player.mp = Math.min(oldMp, player.mmp || oldMp);
            if (typeof logSys === 'function') { try { logSys('裝備了 ' + (typeof getItemFullName === 'function' ? getItemFullName(equipped) : d.n) + '。'); } catch (e) {} }
            closePicker();
            if (typeof renderTabs === 'function') renderTabs(true);
            if (typeof renderSkillSelects === 'function') renderSkillSelects();
            if (typeof saveGame === 'function') saveGame();
        }
        function renderCandidates() {
            if (!panel) return;
            var q = String((panel.querySelector('.afk-equip-pick-search') || {}).value || '').toLowerCase().trim();
            var list = panel.querySelector('.afk-equip-pick-list'); if (!list) return;
            list.replaceChildren();
            var shown = 0;
            candidates.forEach(function (item) {
                var d = itemDef(item), name = plainItemName(item, d);
                if (q && (name + ' ' + item.id).toLowerCase().indexOf(q) < 0) return;
                if (shown++ >= 120) return;
                var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'afk-equip-pick-item tip-host';
                btn.dataset.tipId = String(item.id);
                if (!item._afkCatalog && item.uid != null) { btn.dataset.tipUid = String(item.uid); btn.dataset.tipSrc = 'inv'; }
                var img = document.createElement('img'); try { img.src = getIconUrl(d); } catch (e) {}
                var text = document.createElement('span'), title = document.createElement('b'), idText = document.createElement('small');
                title.textContent = name + ((item.cnt || 1) > 1 ? ' ×' + item.cnt : '');
                idText.textContent = (item._afkCatalog ? '＋ 新增・' : '背包・') + item.id;
                text.appendChild(title); text.appendChild(idText); btn.appendChild(img); btn.appendChild(text); btn.onclick = function () { exactEquip(activeSlot, item); }; list.appendChild(btn);
            });
            if (!shown) showMessage(candidates.length ? '沒有符合搜尋條件的物品' : '背包沒有可裝備物品');
        }
        function scanCandidates(slot) {
            var token = ++scanToken, index = 0, length = player && Array.isArray(player.inv) ? player.inv.length : 0, catalogIds = [], catalogIndex = 0, ownedIds = new Set();
            try { catalogIds = Object.keys(DB.items || {}); } catch (e) {}
            try {
                (player.inv || []).forEach(function (item) { if (item && item.id) ownedIds.add(String(item.id)); });
                Object.keys(player.eq || {}).forEach(function (key) { var item = player.eq[key]; if (item && item.id) ownedIds.add(String(item.id)); });
            } catch (e) {}
            candidates = []; showMessage('讀取中…');
            function work() {
                if (token !== scanToken || !panel) return;
                var start = performance.now(), handled = 0;
                while (index < length && handled < 100) {
                    var item = player.inv[index++]; if (accepts(slot, item)) candidates.push(item); handled++;
                    var pending = false; try { pending = !!(navigator.scheduling && navigator.scheduling.isInputPending && navigator.scheduling.isInputPending()); } catch (e) {}
                    if (pending || performance.now() - start >= 2) break;
                }
                if (index < length) { if (typeof requestIdleCallback === 'function') requestIdleCallback(work, { timeout: 50 }); else setTimeout(work, 0); return; }
                var cStart = performance.now(), cHandled = 0;
                while (catalogIndex < catalogIds.length && cHandled < 100) {
                    var id = catalogIds[catalogIndex++], synthetic = { id: id, cnt: 1, uid: 'catalog:' + id, en: 0, bless: false, anc: false, attr: false, seteff: false, _afkCatalog: true };
                    if (!ownedIds.has(String(id)) && accepts(slot, synthetic)) candidates.push(synthetic); cHandled++;
                    var cPending = false; try { cPending = !!(navigator.scheduling && navigator.scheduling.isInputPending && navigator.scheduling.isInputPending()); } catch (e) {}
                    if (cPending || performance.now() - cStart >= 2) break;
                }
                if (catalogIndex < catalogIds.length) { if (typeof requestIdleCallback === 'function') requestIdleCallback(work, { timeout: 50 }); else setTimeout(work, 0); return; }
                renderCandidates();
            }
            work();
        }
        function openPicker(slot, label, replace) {
            closePicker(); activeSlot = slot; allowReplace = !!replace;
            panel = document.createElement('div'); panel.id = 'afk-equip-picker';
            panel.innerHTML = '<div class="afk-equip-pick-card"><div class="afk-equip-pick-head"><b>自訂' + label + '</b><button type="button" aria-label="關閉">×</button></div><div class="afk-equip-pick-hint">同時列出背包裝備與可直接新增的職業相容裝備</div><input class="afk-equip-pick-search" type="search" placeholder="搜尋裝備名稱或 ID…"><div class="afk-equip-pick-list"></div></div>';
            document.body.appendChild(panel);
            panel.querySelector('.afk-equip-pick-head button').onclick = closePicker;
            panel.querySelector('.afk-equip-pick-search').oninput = renderCandidates;
            AFKRuntime.layers.open('equipment-picker', { element:panel, content:panel.querySelector('.afk-equip-pick-card'), position:false, onClose:function () { scanToken++; if (panel && panel.parentNode) panel.parentNode.removeChild(panel); panel = null; activeSlot = ''; candidates = []; allowReplace = false; } });
            scanCandidates(slot);
        }
        window.__afkOpenEquipmentPicker = openPicker;
        function decorateEmptySlots() {
            var root = document.getElementById('tab-equip'); if (!root) return;
            var ring = 0, ear = 0;
            Array.prototype.forEach.call(root.querySelectorAll('.list-item'), function (row) {
                if (row.dataset.afkEmptySlot) return;
                var spans = row.querySelectorAll('span'); if (spans.length < 2) return;
                var label = spans[0].textContent.trim(), slot = LABEL_SLOT[label] || '';
                if (label === '戒指') slot = 'ring' + (++ring); else if (label === '耳環') slot = 'ear' + (++ear);
                if (!slot || (requiredLevel(slot) && player.lv < requiredLevel(slot))) return;
                var empty = spans[1].textContent.indexOf('空') >= 0;
                row.dataset.afkEmptySlot = slot;
                if (empty) {
                    row.classList.add('afk-empty-equip-slot'); row.tabIndex = 0; row.setAttribute('role', 'button');
                    row.title = '點擊選擇或自訂可裝備物品';
                    var activate = function (e) { if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; if (e) e.preventDefault(); openPicker(slot, label, false); };
                    row.addEventListener('click', activate); row.addEventListener('keydown', activate);
                }
            });
        }
        function hook() {
            AFKRuntime.hooks.after('_renderEquipTab', 'empty-equipment', decorateEmptySlots);
            decorateEmptySlots();
        }
        AFKRuntime.when('empty-equipment:render', function () { return typeof window._renderEquipTab === 'function'; }, hook);
    }

    // ============================================================
    //  🏅 狀態列職業專精顯示與自訂
    // ============================================================
    function initMasteryBadgeModule() {
        var panel = null, lastPlayer = null, lastMastery = null;
        function data() { try { return MASTERY_DATA[player.cls] || null; } catch (e) { return null; } }
        function toneOf(md, id) { var ids = md && md.list ? Object.keys(md.list) : []; return Math.max(0, ids.indexOf(id)) % 6; }
        function closePanel() {
            if (AFKRuntime.layers.close('mastery-settings', 'button')) return;
            if (panel && panel.parentNode) panel.parentNode.removeChild(panel); panel = null;
        }
        function syncBadge() {
            if (typeof player === 'undefined' || !player) return;
            var header = document.querySelector('#status-panel .panel-header'), name = document.getElementById('st-class'); if (!header || !name) return;
            var host = document.getElementById('afk-mastery-host');
            if (!host) { host = document.createElement('div'); host.id = 'afk-mastery-host'; header.insertAdjacentElement('afterend', host); }
            var badge = document.getElementById('afk-mastery-badge');
            if (!badge) { badge = document.createElement('button'); badge.id = 'afk-mastery-badge'; badge.type = 'button'; host.appendChild(badge); badge.onclick = function (e) { e.stopPropagation(); openPanel(badge); }; }
            else if (badge.parentNode !== host) host.appendChild(badge);
            var md = data(), cur = md && md.list ? md.list[player.mastery] : null;
            badge.innerHTML = md ? '<img src="' + md.logo + '" alt=""><span><small>職業專精</small><b>' + (cur ? cur.n : '尚未選擇') + '</b></span><em>變更</em>' : '<span><small>職業專精</small><b>尚無專精</b></span>';
            badge.dataset.tone = String(cur ? toneOf(md, player.mastery) : 0);
            badge.classList.toggle('empty', !cur); badge.title = cur ? cur.d : '點擊自訂職業專精';
            lastPlayer = player; lastMastery = player.mastery || '';
        }
        function choose(id) {
            var md = data(); if (!md || !md.list[id]) return;
            player.mastery = id; player.masteryQuest = 'done';
            closePanel();
            if (typeof calcStats === 'function') calcStats();
            if (typeof renderSkillSelects === 'function') renderSkillSelects();
            if (typeof renderTabs === 'function') renderTabs(true);
            if (typeof saveGame === 'function') saveGame();
            syncBadge();
        }
        function openPanel(anchor) {
            closePanel(); var md = data(); if (!md) return;
            panel = document.createElement('div'); panel.id = 'afk-mastery-panel';
            var title = document.createElement('div'); title.className = 'afk-mastery-title'; title.innerHTML = '<img src="' + md.logo + '" alt=""><div><b>選擇職業專精</b><small>立即套用並保存目前角色</small></div>';
            panel.appendChild(title);
            Object.keys(md.list).forEach(function (id) {
                var m = md.list[id], btn = document.createElement('button'); btn.type = 'button'; btn.className = 'afk-mastery-option' + (player.mastery === id ? ' active' : '');
                btn.dataset.tone = String(toneOf(md, id));
                btn.innerHTML = '<b>' + m.n + '</b><span>' + m.msg + '</span>'; btn.title = m.d; btn.onclick = function () { choose(id); }; panel.appendChild(btn);
            });
            document.body.appendChild(panel);
            AFKRuntime.layers.open('mastery-settings', { element:panel, anchor:anchor, triggers:[anchor], gap:8, onClose:function () { if (panel && panel.parentNode) panel.parentNode.removeChild(panel); panel = null; } });
        }
        function hook() {
            AFKRuntime.hooks.after('updateUI', 'mastery-badge', function () { if (player !== lastPlayer || (player.mastery || '') !== lastMastery || !document.getElementById('afk-mastery-badge')) syncBadge(); });
            syncBadge();
        }
        AFKRuntime.when('mastery:ui-hook', function () { return typeof window.updateUI === 'function'; }, hook);
    }

    // ============================================================
    //  🧭 NPC 製作材料來源與快速前往
    // ============================================================
    function trialNpcForItem(id) {
        var routes = {
            new_item_196:'npc_ricky', new_item_198:'npc_ricky', new_item_206:'npc_ricky',
            new_item_204:'npc_james', new_item_205:'npc_james', new_item_203:'npc_james',
            new_item_144:'npc_gunter', new_item_208:'npc_gunter', new_item_211:'npc_gunter', new_item_241:'npc_gunter',
            new_item_199:'npc_os', new_item_200:'npc_os', new_item_201:'npc_os', new_item_202:'npc_os',
            new_item_214:'npc_taras', new_item_212:'npc_taras', new_item_240:'npc_taras',
            new_item_213:'npc_mother', item_nightvision:'npc_masha', item_blueflute:'npc_masha',
            item_ancientkey:'npc_masha', item_lost_soul:'npc_masha',
            item_death_oath:'npc_runde', item_orc_elder_head:'npc_kang', item_yeti_head:'npc_brudica',
            item_fallen_key:'npc_brudica', item_chaos_key:'npc_brudica',
            item_ant_fruit:'npc_shenien', item_ant_branch:'npc_shenien', item_ant_bark:'npc_shenien',
            item_elmore_heart:'npc_shenien', item_time_orb:'npc_shenien', item_wyvern_blood:'npc_shenien',
            new_item_207:'npc_duwen', new_item_226:'npc_duwen', new_item_225:'npc_duwen',
            new_item_219:'npc_duwen', item_cyclops_blood:'npc_duwen', new_item_234:'npc_duwen',
            item_demon_search:'npc_procel', item_demon_spy:'npc_procel', item_yeti_heart:'npc_procel', item_soulfire_ash:'npc_procel',
            item_dantes_letter:'npc_digallatin', item_elf_whisper:'npc_digallatin', item_ancient_book:'npc_digallatin',
            item_sealed_intel:'npc_digallatin', item_spy_report:'npc_digallatin', item_royal_order:'npc_digallatin',
            mat_flame_sword:'npc_digallatin', mat_flame_claw:'npc_digallatin', mat_flame_eye:'npc_digallatin', mat_flame_heart:'npc_digallatin'
        };
        return routes[String(id || '')] || '';
    }
    function isExtraTrialGuideItem(id) { return !!trialNpcForItem(id); }

    function initNpcMaterialGuideModule() {
        var craftIndex = null, dropIndex = null, npcIndex = null, shopIndex = null, exchangeIndex = null, panel = null;
        var guideNames = null, guideNameMap = null;
        var dialogueObserver = null, dialogueRootObserver = null, dialogueRaf = 0, decoratingDialogue = false;
        function buildIndexes() {
            craftIndex = {}; dropIndex = {}; npcIndex = {}; shopIndex = {}; exchangeIndex = {};
            guideNames = null; guideNameMap = null;
            try { Object.keys(DB.towns || {}).forEach(function (town) { (DB.towns[town].npcs || []).forEach(function (npc) { npcIndex[npc.id] = { town: town, npc: npc }; }); }); } catch (e) {}
            function addRoute(index, id, route) {
                if (!id || id === 'gold' || !DB.items[id]) return;
                if (!index[id]) index[id] = [];
                var key = [route.kind || '', route.npc || '', route.town || '', route.map || '', route.note || ''].join('|');
                if (!index[id].some(function (x) { return x._key === key; })) { route._key = key; index[id].push(route); }
            }
            try {
                Object.keys(CRAFT_RECIPES || {}).forEach(function (npc) {
                    (CRAFT_RECIPES[npc] || []).forEach(function (r) {
                        addRoute(craftIndex, r.result, { kind:'craft', npc:npc });
                        (r.req || []).forEach(function (q) { if (q && q.id !== 'gold') addRoute(exchangeIndex, q.id, { kind:'used', npc:npc, note:'此 NPC 的製作材料' }); });
                    });
                });
            } catch (e) {}
            var mobMaps = {};
            try { Object.keys(DB.maps || {}).forEach(function (map) { (DB.maps[map] || []).forEach(function (mid) { var mob = DB.mobs[mid]; if (mob && mob.n) { if (!mobMaps[mob.n]) mobMaps[mob.n] = []; if (mobMaps[mob.n].indexOf(map) < 0) mobMaps[mob.n].push(map); } }); }); } catch (e) {}
            function addDrop(id, mob, map, note) {
                if (!id || !map || !DB.maps[map]) return;
                if (!dropIndex[id]) dropIndex[id] = [];
                if (!dropIndex[id].some(function (x) { return x.mob === mob && x.map === map; })) dropIndex[id].push({ mob:mob, map:map, note:note || '' });
            }
            function addNamedDrop(id, mob) { (mobMaps[mob] || []).forEach(function (map) { addDrop(id, mob, map); }); }
            function ingestDropTable(table) {
                Object.keys(table || {}).forEach(function (mob) {
                    (table[mob] || []).forEach(function (row) { if (row && row[0]) addNamedDrop(row[0], mob); });
                });
            }
            try { ingestDropTable(typeof MOB_DROPS !== 'undefined' ? MOB_DROPS : {}); } catch (e) {}
            try { ingestDropTable(typeof DARK_WEAPON_DROPS !== 'undefined' ? DARK_WEAPON_DROPS : {}); } catch (e) {}
            try { ingestDropTable(typeof DARK_CRYSTAL_DROPS !== 'undefined' ? DARK_CRYSTAL_DROPS : {}); } catch (e) {}
            try { ingestDropTable(typeof DRAGON_DROPS !== 'undefined' ? DRAGON_DROPS : {}); } catch (e) {}
            try { ingestDropTable(typeof WARRIOR_DROPS !== 'undefined' ? WARRIOR_DROPS : {}); } catch (e) {}
            try { ingestDropTable(typeof MEM_DROPS !== 'undefined' ? MEM_DROPS : {}); } catch (e) {}
            [
                ['item_dantes_letter','黑暗妖精將軍'], ['item_ancient_book','巨大兵蟻'],
                ['item_chaos_key','黑暗棲林者'], ['item_royal_order','小惡魔'],
                ['item_sealed_intel','魔族暗殺團'], ['item_spy_report','魔族暗殺團'],
                ['new_item_241','黑騎士搜索隊']
            ].forEach(function (row) { addNamedDrop(row[0], row[1]); });
            addDrop('item_elf_whisper', '精靈墓穴怪物', 'elf_grave');
            try {
                Object.keys(DB.maps || {}).forEach(function (map) {
                    (DB.maps[map] || []).forEach(function (mid) {
                        var mob = DB.mobs && DB.mobs[mid];
                        if (mob && mob.race === '血盟') addDrop('new_item_241', mob.n || '血盟敵人', map);
                    });
                });
            } catch (e) {}

            // Source 的條件式掉落不在任何 *_DROPS 表內，需依真正的擊殺規則補入。
            try { (AREA_BONUS_MAPS || []).forEach(function (map) { (AREA_BONUS_ITEMS || []).forEach(function (id) { addDrop(id, '此區域所有怪物', map, '區域額外掉落'); }); }); } catch (e) {}
            [['石頭高崙',100],['鋼鐵高崙',100],['侏儒',50],['侏儒戰士',50],['黑騎士',50],['哈柏哥布林',50],['蜥蜴人',50]].forEach(function (x) { addNamedDrop('mat_silverore', x[0]); });
            try {
                Object.keys(DB.maps || {}).forEach(function (map) {
                    var cat = ''; try { cat = typeof mapCategoryOf === 'function' ? mapCategoryOf(map) : ''; } catch (e) {}
                    var region = ''; try { region = typeof mapRegionOf === 'function' ? mapRegionOf(map) : ''; } catch (e) {}
                    if (map === 'silent_outer') { addDrop('mat_blackstone2','沉默洞穴周邊怪物',map,'固定掉落'); addDrop('mat_blackstone3','沉默洞穴周邊怪物',map,'固定掉落'); }
                    if (cat === 'wild' || cat === 'dungeon') {
                        addDrop('mat_blackstone2','野外／地監怪物',map,'需學會提煉魔石');
                        addDrop('mat_blackstone3','野外／地監怪物',map,'需學會提煉魔石');
                        addDrop('mat_blackstone4','野外／地監怪物',map,'需學會提煉魔石');
                    }
                    if (region === 'rastabad') addDrop('mat_holy_relic','拉斯塔巴德區域怪物',map,'需持有死亡騎士之印記');
                    (DB.maps[map] || []).forEach(function (mid) {
                        var mob = DB.mobs && DB.mobs[mid]; if (!mob) return;
                        if ((mob.lv || 0) >= 40 && mob.race !== '血盟' && !(mob.boss && map === 'dream_island')) {
                            ['panacea_str','panacea_dex','panacea_con','panacea_int','panacea_wis','panacea_cha'].forEach(function (id) { addDrop(id, mob.n || '高等怪物', map, '等級 40 以上稀有掉落'); });
                        }
                        var fruit = {water:'new_fruit_rabbit',fire:'new_fruit_fox',earth:'new_fruit_beagle',wind:'new_fruit_stbernard'}[mob.e];
                        if (fruit) addDrop(fruit, mob.n || '屬性怪物', map, '屬性怪物機率掉落');
                    });
                });
            } catch (e) {}
            [['new_item_184','杜賓狗'],['new_item_185','狼'],['new_item_collar_husky','哈士奇'],['new_item_238','牧羊犬']].forEach(function (x) { addNamedDrop(x[0], x[1]); });

            // 一般商店：具名清單與 default 清單都依實際 NPC 所在村莊建立路由。
            try {
                Object.keys(npcIndex).forEach(function (npcId) {
                    var row = npcIndex[npcId], npc = row.npc;
                    if (!npc || (npc.type !== 'shop' && npcId !== 'npc_gilen')) return;
                    var ids = (SHOP_LISTS && (SHOP_LISTS[npcId] || SHOP_LISTS.default)) || [];
                    ids.forEach(function (id) { addRoute(shopIndex, id, { kind:'shop', npc:npcId, town:row.town }); });
                });
            } catch (e) {}

            function addExchangeNpc(npcId, ids, note) {
                (ids || []).forEach(function (id) { addRoute(exchangeIndex, id, { kind:'exchange', npc:npcId, note:note || '試煉／兌換' }); });
            }
            function scanExchangeTable(table, npcId) {
                Object.keys(table || {}).forEach(function (key) {
                    var cfg = table[key] || {}, ids = [];
                    (cfg.cost || []).forEach(function (q) { ids.push(Array.isArray(q) ? q[0] : q.id); });
                    (cfg.rewards || []).forEach(function (q) { ids.push(q && q.id ? q.id : q); });
                    if (cfg.req) ids.push(cfg.req); if (cfg.reward) ids.push(cfg.reward);
                    addExchangeNpc(npcId, ids);
                });
            }
            try { Object.keys(DARK_TRIAL_CFG || {}).forEach(function (npcId) { var c = DARK_TRIAL_CFG[npcId]; addExchangeNpc(npcId, [c.req,c.reward]); }); } catch (e) {}
            try { scanExchangeTable(SHENIEN_EX, 'npc_shenien'); } catch (e) {}
            try { scanExchangeTable(WARRIOR_EX, 'npc_duwen'); } catch (e) {}
            try { scanExchangeTable(PROCEL_EX, 'npc_procel'); } catch (e) {}
            try {
                Object.keys(TRIAL_50_CFG || {}).forEach(function (cls) {
                    var c = TRIAL_50_CFG[cls], npcId = c.npc === '布魯迪卡' ? 'npc_brudica' : 'npc_digallatin', ids = [c.exMat];
                    (c.stages || []).forEach(function (s) { ids.push(s.id); }); (c.rewards || []).forEach(function (x) { ids.push(x.id || x); }); addExchangeNpc(npcId, ids, '50 級職業試煉');
                });
            } catch (e) {}
            try { addExchangeNpc('npc_yuria', (YURIA_REWARDS || []).concat(YURIA_HATIN_REWARDS || []).map(function (x) { return x.id || x; }).concat(['item_olin_diary','item_hatin_diary'])); } catch (e) {}
            try { addExchangeNpc('npc_shimizhe', (SHIMIZHE_REWARDS || []).concat(['item_son_letter','item_son_remains','item_son_portrait'])); } catch (e) {}
            addExchangeNpc('npc_shenien', ['mat_rift_shard']);
            addExchangeNpc('npc_duwen', ['new_item_219']);
            addExchangeNpc('npc_procel', ['mat_rift_shard']);
            addExchangeNpc('npc_red', ['new_item_150','acc_summon_ctrl','acc_minion_proof_1','acc_minion_proof_2','acc_minion_proof_3','acc_minion_proof_4','acc_minion_proof_5']);
        }
        function closeGuide() {
            if (AFKRuntime.layers.close('material-source', 'button')) return;
            if (panel && panel.parentNode) panel.parentNode.removeChild(panel); panel = null;
        }
        function goMap(map) {
            closeGuide(); var select = document.getElementById('map-select'); if (!select || !DB.maps[map]) return;
            if (!Array.from(select.options).some(function (o) { return o.value === map; })) { var opt = document.createElement('option'); opt.value = map; try { var entry = typeof mapEntryOf === 'function' ? mapEntryOf(map) : null; opt.textContent = entry && entry.t ? entry.t : map; } catch (e) { opt.textContent = map; } select.appendChild(opt); }
            select.value = map; if (typeof changeMap === 'function') changeMap(true);
        }
        function goNpc(npcId) {
            closeGuide(); var row = npcIndex && npcIndex[npcId]; if (!row) return;
            var select = document.getElementById('map-select'); if (select) { if (!Array.from(select.options).some(function (o) { return o.value === row.town; })) { var opt = document.createElement('option'); opt.value = row.town; opt.textContent = DB.towns[row.town].n || row.town; select.appendChild(opt); } select.value = row.town; }
            if (typeof changeMap === 'function') changeMap(true);
            setTimeout(function () { if (typeof interactNPC === 'function') interactNPC(npcId, row.town); }, 0);
        }
        function currentPandoraHas(id) {
            try { return !!(player && player.pandoraMarket2 && (player.pandoraMarket2.slots || []).some(function (slot) { return slot && !slot.sold && slot.id === id; })); } catch (e) { return false; }
        }
        function openGuide(id, anchor) {
            if (!craftIndex) buildIndexes(); closeGuide();
            var ids = String(id || '').split(',').filter(function (x, i, all) { return DB.items[x] && all.indexOf(x) === i; });
            if (!ids.length) return;
            panel = document.createElement('div'); panel.id = 'afk-material-guide';
            var names = ids.map(function (x) { return DB.items[x].n || x; }).filter(function (x, i, all) { return all.indexOf(x) === i; });
            var head = document.createElement('div'), title = document.createElement('b'), close = document.createElement('button');
            head.className = 'afk-material-head'; title.textContent = '🧭 ' + names.join('／'); close.type = 'button'; close.textContent = '×'; close.onclick = closeGuide;
            head.appendChild(title); head.appendChild(close); panel.appendChild(head);
            var routeKeys = Object.create(null), routeCount = 0;
            function route(key, cls, label, detail, action) {
                if (!key || routeKeys[key]) return; routeKeys[key] = true; routeCount++;
                var b = document.createElement('button'), strong = document.createElement('b'), span = document.createElement('span');
                b.type = 'button'; b.className = 'afk-material-route ' + cls; strong.textContent = label; span.textContent = detail;
                b.appendChild(strong); b.appendChild(span); b.onclick = action; panel.appendChild(b);
            }
            ids.forEach(function (itemId) {
                (dropIndex[itemId] || []).slice(0, 40).forEach(function (src) {
                    var mapName = src.map; try { var entry = typeof mapEntryOf === 'function' ? mapEntryOf(src.map) : null; mapName = entry && entry.t ? entry.t : src.map; } catch (e) {}
                    route('map|' + src.map + '|' + src.mob, 'hunt', '👹 前往狩獵', src.mob + '・' + mapName + (src.note ? '・' + src.note : ''), function () { goMap(src.map); });
                });
                var trialNpc = trialNpcForItem(itemId), trialRow = trialNpc && npcIndex[trialNpc];
                if (trialRow) route('trial|' + trialNpc, 'trial', '⚔️ 前往職業試煉', (trialRow.npc.n || trialNpc) + '・' + (DB.towns[trialRow.town].n || trialRow.town), function () { goNpc(trialNpc); });
                (craftIndex[itemId] || []).forEach(function (src) {
                    var row = npcIndex[src.npc]; if (!row) return;
                    route('craft|' + src.npc, 'craft', '⚒️ 前往製作', (row.npc.n || src.npc) + '・' + (DB.towns[row.town].n || row.town), function () { goNpc(src.npc); });
                });
                (shopIndex[itemId] || []).forEach(function (src) {
                    var row = npcIndex[src.npc]; if (!row) return;
                    route('shop|' + src.npc, 'shop', '🛒 前往商店', (row.npc.n || src.npc) + '・' + (DB.towns[row.town].n || row.town), function () { goNpc(src.npc); });
                });
                (exchangeIndex[itemId] || []).forEach(function (src) {
                    var row = npcIndex[src.npc]; if (!row) return;
                    route('exchange|' + src.npc, 'trial', src.kind === 'used' ? '🧩 前往材料用途' : '⚔️ 前往試煉／兌換', (row.npc.n || src.npc) + '・' + (DB.towns[row.town].n || row.town) + (src.note ? '・' + src.note : ''), function () { goNpc(src.npc); });
                });
                if (currentPandoraHas(itemId)) {
                    route('pandora|' + itemId, 'market', '🔮 開啟潘朵拉黑市', '目前正在販售「' + (DB.items[itemId].n || itemId) + '」', function () {
                        closeGuide(); window.dispatchEvent(new CustomEvent('afk-open-pandora-item', { detail:{ id:itemId } }));
                    });
                }
            });
            if (!routeCount) {
                var empty = document.createElement('div'), notes = [];
                ids.forEach(function (itemId) { try { var x = AFK_EXTRA && AFK_EXTRA.itemAcquire && AFK_EXTRA.itemAcquire[itemId]; if (x && x.short) notes.push(x.short); } catch (e) {} });
                empty.className = 'afk-material-empty'; empty.textContent = notes.length ? notes.filter(function (x, i, all) { return all.indexOf(x) === i; }).join('；') : '此物品屬於任務、寶箱、活動或特殊取得，目前沒有可直接傳送的固定來源。'; panel.appendChild(empty);
            }
            document.body.appendChild(panel);
            var target = anchor && anchor.getBoundingClientRect ? anchor : document.body;
            AFKRuntime.layers.open('material-source', { element:panel, anchor:target, triggers:[target], gap:6, onClose:function () { if (panel && panel.parentNode) panel.parentNode.removeChild(panel); panel = null; } });
        }
        function hookCraftHtml() {
            AFKRuntime.hooks.intercept('craftReqHtml', 'material-guide', function (next, self, args) {
                var req = args[0], html = next.apply(null, args);
                (req || []).forEach(function (r) { if (!r || r.id === 'gold' || !DB.items[r.id]) return; var n = DB.items[r.id].n; html = html.replace(n, '<button type="button" class="afk-material-link" data-afk-material="' + r.id + '">' + n + '</button>'); });
                return html;
            });
        }
        function hasIndexedSource(id) {
            return !!((craftIndex[id] || []).length || (dropIndex[id] || []).length || (shopIndex[id] || []).length || (exchangeIndex[id] || []).length || trialNpcForItem(id) || currentPandoraHas(id));
        }
        function appendTrialAction(item) {
            if (!craftIndex) buildIndexes();
            var actions = document.getElementById('modal-actions'), itemId = item && item.id;
            if (!actions) return;
            var old = actions.querySelector('[data-afk-trial-action]'); if (old) old.remove();
            if (!itemId || !DB.items[itemId] || !hasIndexedSource(itemId)) return;
            var button = document.createElement('button'); button.type = 'button'; button.className = 'afk-trial-modal-action';
            button.dataset.afkTrialAction = String(itemId); button.innerHTML = '<b>🧭 查看取得來源</b><small>狩獵、製作、試煉、兌換、商店與黑市</small>';
            button.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openGuide(itemId, button); };
            actions.insertBefore(button, actions.firstChild);
        }
        function hookItemModal() {
            AFKRuntime.hooks.after('openModal', 'material-guide', function (result, args) { appendTrialAction(args[0]); }, { frame:false });
        }
        function trialNameEntries() {
            if (guideNames) return guideNames;
            if (!craftIndex) buildIndexes();
            var byName = Object.create(null), ids = Object.create(null);
            [craftIndex, dropIndex, shopIndex, exchangeIndex].forEach(function (index) { Object.keys(index || {}).forEach(function (id) { ids[id] = true; }); });
            Object.keys(DB.items || {}).forEach(function (id) { if (trialNpcForItem(id) || currentPandoraHas(id)) ids[id] = true; });
            Object.keys(ids).forEach(function (id) {
                var def = DB.items[id], name = def && String(def.n || '').trim(); if (!name) return;
                if (!byName[name]) byName[name] = []; if (byName[name].indexOf(id) < 0) byName[name].push(id);
            });
            guideNameMap = byName;
            guideNames = Object.keys(byName).sort(function (a, b) { return b.length - a.length; }).map(function (name) { return { name:name, id:byName[name].join(',') }; });
            return guideNames;
        }
        function decorateTrialDialogue() {
            dialogueRaf = 0;
            var root = document.getElementById('interaction-content');
            if (!root || decoratingDialogue) return;
            var entries = trialNameEntries(); if (!entries.length) return;
            decoratingDialogue = true;
            try {
                var nodes = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
                while (walker.nextNode()) {
                    var node = walker.currentNode, parent = node.parentElement;
                    if (!parent || !node.nodeValue || !node.nodeValue.trim()) continue;
                    if (parent.closest('button,a,input,select,textarea,script,style,[data-afk-trial-item],[data-afk-material]')) continue;
                    if (entries.some(function (entry) { return node.nodeValue.indexOf(entry.name) >= 0; })) nodes.push(node);
                }
                nodes.forEach(function (node) {
                    var text = node.nodeValue, fragment = document.createDocumentFragment(), cursor = 0;
                    while (cursor < text.length) {
                        var found = null, foundAt = -1;
                        entries.forEach(function (entry) {
                            var at = text.indexOf(entry.name, cursor);
                            if (at >= 0 && (foundAt < 0 || at < foundAt || (at === foundAt && entry.name.length > found.name.length))) { found = entry; foundAt = at; }
                        });
                        if (!found) { fragment.appendChild(document.createTextNode(text.slice(cursor))); break; }
                        if (foundAt > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, foundAt)));
                        var link = document.createElement('button'); link.type = 'button'; link.className = 'afk-trial-dialog-link afk-material-link';
                        link.dataset.afkMaterial = found.id; link.textContent = found.name; link.title = '查看狩獵、製作、試煉、兌換與商店來源';
                        fragment.appendChild(link); cursor = foundAt + found.name.length;
                    }
                    if (fragment.childNodes.length) node.parentNode.replaceChild(fragment, node);
                });
            } finally { decoratingDialogue = false; }
        }
        function queueDialogueDecoration() {
            AFKRuntime.schedule('material:dialogue', decorateTrialDialogue);
        }
        function attachDialogueObserver() {
            var root = document.getElementById('interaction-content');
            if (!root) {
                if (!dialogueRootObserver) {
                    dialogueRootObserver = new MutationObserver(function () {
                        if (!document.getElementById('interaction-content')) return;
                        dialogueRootObserver.disconnect(); dialogueRootObserver = null; attachDialogueObserver();
                    });
                    dialogueRootObserver.observe(document.documentElement, { childList:true, subtree:true });
                }
                return;
            }
            if (dialogueObserver) dialogueObserver.disconnect();
            dialogueObserver = new MutationObserver(queueDialogueDecoration);
            dialogueObserver.observe(root, { childList:true, subtree:true, characterData:true });
            queueDialogueDecoration();
        }
        document.addEventListener('click', function (e) {
            var trialLink = e.target.closest && e.target.closest('[data-afk-trial-item]');
            if (trialLink) { e.preventDefault(); e.stopPropagation(); openGuide(trialLink.dataset.afkTrialItem, trialLink); return; }
            var link = e.target.closest && e.target.closest('[data-afk-material]');
            if (link) { e.preventDefault(); e.stopPropagation(); openGuide(link.dataset.afkMaterial, link); return; }
        }, true);
        AFKRuntime.when('material:indexes', function () { return typeof DB !== 'undefined' && DB.items && DB.towns; }, function () { buildIndexes(); attachDialogueObserver(); });
        AFKRuntime.when('material:craft-hook', function () { return typeof window.craftReqHtml === 'function'; }, hookCraftHtml);
        AFKRuntime.when('material:item-hook', function () { return typeof window.openModal === 'function'; }, hookItemModal);
    }

    // ============================================================
    //  🤝 協力隊伍分類與精簡卡片
    // ============================================================
    function initSquadLayoutModule() {
        var KEY = 'afk_squad_type_tab';
        var PET_GROUP_KEY = 'afk_pet_reserve_open';
        var activeType = localStorage.getItem(KEY) || 'mercenary';
        if (['mercenary', 'pet', 'summon'].indexOf(activeType) < 0) activeType = 'mercenary';
        var expandedUid = '', renderRaf = 0, original = null, lastSkillSig = '', lastTeamSig = '', playerRef = null;
        var reserveOpen = localStorage.getItem(PET_GROUP_KEY) === 'true';
        var labels = { mercenary:'傭兵', pet:'寵物', summon:'召喚物' };
        var icons = { mercenary:'🤝', pet:'🐾', summon:'🔮' };

        function esc(value) {
            return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; });
        }
        function pct(cur, max) { return Math.max(0, Math.min(100, Math.floor(Number(cur || 0) / Math.max(1, Number(max || 1)) * 100))); }
        function petName(p) { try { return typeof petDisplayName === 'function' ? petDisplayName(p) : (p.form || '寵物'); } catch (e) { return p.form || '寵物'; } }
        function collect() {
            var allies = [], pets = [], summons = [], summonConfigured = false;
            try { allies = player && Array.isArray(player.allies) ? player.allies.filter(Boolean) : []; } catch (e) {}
            try {
                pets = typeof petRoster === 'function' ? petRoster().filter(Boolean) : (typeof petsOutList === 'function' ? petsOutList().filter(Boolean) : []);
                var slot = String(currentSlot);
                pets = pets.map(function (pet, index) { return { pet:pet, index:index }; }).sort(function (a, b) {
                    function rank(p) { return String(p.outSlot) === slot ? 0 : (p.outSlot != null ? 1 : 2); }
                    return rank(a.pet) - rank(b.pet) || a.index - b.index;
                }).map(function (row) { return row.pet; });
            } catch (e) {}
            try {
                summons = typeof summonV2List === 'function' ? summonV2List().filter(function (s) { return s && !s._downed && Number(s.hp || 0) > 0; }) : [];
                var sid = typeof summonV2ActiveSk === 'function' ? summonV2ActiveSk() : '';
                summonConfigured = !!(player && player._summonV2On && sid && typeof summonV2Knows === 'function' && summonV2Knows(sid));
            } catch (e) {}
            return { mercenary:allies, pet:pets, summon:summons, summonConfigured:summonConfigured };
        }
        function skillSignature(allies) {
            return allies.map(function (a) {
                var auto = a && a._autoBuff ? Object.keys(a._autoBuff).sort().map(function (k) { return k + ':' + (a._autoBuff[k] ? 1 : 0); }).join(',') : '';
                return [a._slot, a._allyName, a.lv, a._downed ? 1 : 0, a._atkSkill, a._healSkill, a._convertSkill, a._healHpPct, a._potHpPct, a._hpSkillPct, a._castMpPct, auto].join(':');
            }).join('|');
        }
        function itemUid(type, item) { return String(type === 'mercenary' ? ('merc-' + item._slot) : (item.uid || (type + '-' + (item.form || item.n || 'x')))); }
        function structuralSignature(data) {
            var list = data[activeType] || [];
            return activeType + '#' + expandedUid + '#R' + (reserveOpen ? 1 : 0) + '#' + ['mercenary','pet','summon'].map(function (type) {
                var rows = data[type] || [];
                return type + ':' + rows.map(function (x) { return [itemUid(type, x), x.lv || 1, x._downed ? 1 : 0, x._allyName || x.form || x.n || '', x.outSlot == null ? '' : x.outSlot, x.locked ? 1 : 0, x.eq && x.eq.wpn && x.eq.wpn.id || '', x.eq && x.eq.arm && x.eq.arm.id || ''].join('/'); }).join(',');
            }).join('|') + '#C' + (data.summonConfigured ? 1 : 0) + '#V' + list.length;
        }
        function statusText(a) {
            if (a._downed) return '倒地';
            var st = a.statuses || {}, out = [];
            [['stun','暈眩'],['freeze','冰凍'],['stone','石化'],['paralyze','麻痺'],['sleep','沉睡'],['silence','沉默'],['magicseal','魔封'],['poison','中毒'],['burn','灼燒'],['scald','燙傷'],['bleed','出血'],['slowAtk','緩速']].forEach(function (row) { if (Number(st[row[0]] || 0) > 0) out.push(row[1]); });
            return out.length ? out.join('・') : '作戰中';
        }
        function mercenaryDetail(a, uid) {
            var slot = esc(a._slot), req = typeof getExpReq === 'function' ? Number(getExpReq(a.lv || 1) || 0) : 0;
            var expPct = req > 0 ? Math.min(100, Math.max(0, Number(a.exp || 0) / req * 100)) : 0;
            var revive = a._downed ? '<div class="afk-squad-actions"><button type="button" data-afk-squad-act="merc-rez" data-slot="' + slot + '">返生術</button><span data-afk-merc-revive>自動復活倒數</span></div>' : '';
            return '<div class="afk-squad-detail">' +
                '<div class="afk-squad-vital"><span>HP</span><i><b data-afk-bar="hp"></b><em data-afk-text="hp"></em></i></div>' +
                '<div class="afk-squad-vital"><span>MP</span><i><b data-afk-bar="mp"></b><em data-afk-text="mp"></em></i></div>' +
                '<div class="afk-squad-vital"><span>EXP</span><i><b data-afk-bar="exp" style="width:' + expPct + '%"></b><em data-afk-text="exp">' + expPct.toFixed(1) + '%</em></i></div>' + revive +
                '<button type="button" class="afk-squad-switch" data-afk-squad-act="merc-switch" data-slot="' + slot + '">💾 存檔並切換至此角色</button></div>';
        }
        function petDetail(p) {
            var uid = esc(p.uid), req = typeof petExpReq === 'function' ? Number(petExpReq(p.lv || 1) || 0) : 0;
            var expPct = req > 0 ? Math.min(100, Math.max(0, Number(p.exp || 0) / req * 100)) : 0;
            var slot = null; try { slot = String(currentSlot); } catch (e) { slot = ''; }
            var isOut = String(p.outSlot) === slot, otherOut = p.outSlot != null && !isOut;
            var canEvolve = false; try { canEvolve = p.lv >= 30 && typeof petEvoOptions === 'function' && petEvoOptions(p).length > 0; } catch (e) {}
            var revive = p._downed && isOut ? '<div class="afk-squad-actions"><button type="button" data-afk-squad-act="pet-rez" data-mode="rez" data-uid="' + uid + '">返生術</button><button type="button" data-afk-squad-act="pet-rez" data-mode="scroll" data-uid="' + uid + '">卷軸復活</button></div>' : '';
            var threshold = isOut && !p._downed ? '<label class="afk-squad-threshold">HP 低於 <input type="number" min="0" max="95" value="' + Number(p.potPct || 0) + '" data-afk-pet-pot="' + uid + '"> % 喝水</label>' : '';
            var owner = otherOut ? '<div class="afk-squad-owner">目前由存檔 ' + esc(p.outSlot) + ' 帶領；按「轉為出戰」會移交至本角色。</div>' : '';
            return '<div class="afk-squad-detail"><div class="afk-squad-vital"><span>HP</span><i><b data-afk-bar="hp"></b><em data-afk-text="hp"></em></i></div><div class="afk-squad-vital"><span>MP</span><i><b data-afk-bar="mp"></b><em data-afk-text="mp"></em></i></div><div class="afk-squad-vital"><span>EXP</span><i><b data-afk-bar="exp" style="width:' + expPct + '%"></b><em data-afk-text="exp">' + expPct.toFixed(1) + '%</em></i></div>' + owner + '<div class="afk-pet-manage"><button type="button" class="gear' + (p.eq && p.eq.wpn ? ' equipped' : '') + '" data-afk-squad-act="pet-gear" data-slot="wpn" data-uid="' + uid + '">⚔ 武器</button><button type="button" class="gear' + (p.eq && p.eq.arm ? ' equipped' : '') + '" data-afk-squad-act="pet-gear" data-slot="arm" data-uid="' + uid + '">🛡 防具</button><button type="button" class="deploy" data-afk-squad-act="pet-deploy" data-uid="' + uid + '">' + (isOut ? '↩ 收回' : (otherOut ? '⇄ 轉為出戰' : '▶ 出戰')) + '</button>' + (canEvolve ? '<button type="button" class="evolve" data-afk-squad-act="pet-evolve" data-uid="' + uid + '">✨ 進化</button>' : '') + '<button type="button" class="lock' + (p.locked ? ' active' : '') + '" data-afk-squad-act="pet-lock" data-uid="' + uid + '">' + (p.locked ? '🔒 已鎖定' : '🔓 鎖定') + '</button>' + (!p.locked ? '<button type="button" class="release" data-afk-squad-act="pet-release" data-uid="' + uid + '">放生</button>' : '') + '</div>' + revive + threshold + '</div>';
        }
        function summonDetail(s) {
            var sid = s.skId || (typeof summonV2ActiveSk === 'function' ? summonV2ActiveSk() : ''), remain = 0;
            try { remain = Math.max(0, Math.ceil(Number(player && player.buffs && player.buffs[sid] || 0))); } catch (e) {}
            var skillName = sid && typeof DB !== 'undefined' && DB.skills && DB.skills[sid] ? DB.skills[sid].n : (sid || '召喚技能');
            return '<div class="afk-squad-detail"><div class="afk-squad-vital"><span>HP</span><i><b data-afk-bar="hp"></b><em data-afk-text="hp"></em></i></div><div class="afk-squad-note">來源：' + esc(skillName) + '<br>剩餘時間：<span data-afk-summon-time>' + Math.floor(remain / 60) + ':' + String(remain % 60).padStart(2, '0') + '</span></div><button type="button" class="afk-squad-switch summon" data-afk-squad-act="summon-recast">重新施放</button></div>';
        }
        function rowHtml(type, item) {
            var uid = itemUid(type, item), expanded = uid === expandedUid;
            var name = type === 'mercenary' ? (item._allyName || '協力傭兵') : (type === 'pet' ? petName(item) : (item.form || item.n || '召喚物'));
            var hp = Number(type === 'mercenary' ? item.curHp : item.hp) || 0, mhp = Math.max(1, Number(item.mhp || 1));
            var petState = '保管中';
            if (type === 'pet') { try { petState = item.outSlot == null ? '保管中' : (String(item.outSlot) === String(currentSlot) ? (item._downed ? '倒地' : '出戰中') : '其他角色出戰中'); } catch (e) {} }
            var stateText = type === 'mercenary' ? statusText(item) : (type === 'pet' ? petState : (item._downed ? '倒地' : '出戰中'));
            var detail = type === 'mercenary' ? mercenaryDetail(item, uid) : (type === 'pet' ? petDetail(item) : summonDetail(item));
            var img = '';
            if (type === 'pet') img = '<img src="assets/anim/' + encodeURIComponent(item.form || '') + '/d6/idle_0.png" alt="" onerror="this.style.display=\'none\'">';
            return '<article class="afk-squad-row ' + type + (item._downed ? ' downed' : '') + (expanded ? ' expanded' : '') + '" data-afk-squad-uid="' + esc(uid) + '" data-afk-squad-type="' + type + '"><button type="button" class="afk-squad-summary" data-afk-squad-expand="' + esc(uid) + '">' + (img || '<span class="afk-squad-avatar">' + icons[type] + '</span>') + '<span class="afk-squad-name"><b>' + esc(name) + '</b><small>Lv.' + Number(item.lv || 1) + '・<span data-afk-state>' + esc(stateText) + '</span></small></span><span class="afk-squad-mini"><i><b data-afk-mini-hp style="width:' + pct(hp, mhp) + '%"></b></i><small data-afk-mini-text>' + Math.floor(hp) + '/' + Math.floor(mhp) + '</small></span><span class="afk-squad-arrow">' + (expanded ? '▾' : '▸') + '</span></button>' + (expanded ? detail : '') + '</article>';
        }
        function tabCount(type, list) {
            return '<button type="button" data-afk-squad-tab="' + type + '" class="' + (activeType === type ? 'active' : '') + '"><span>' + icons[type] + ' ' + labels[type] + '</span><b>' + list.length + '</b></button>';
        }
        function rebuildTeam(data) {
            var root = document.getElementById('squad-tab-team'); if (!root) return;
            var list = data[activeType] || [], down = list.filter(function (x) { return !!x._downed; }).length;
            var active = activeType === 'pet' ? list.filter(function (x) { try { return String(x.outSlot) === String(currentSlot); } catch (e) { return false; } }).length : Math.max(0, list.length - down);
            var empty = activeType === 'summon' && data.summonConfigured ? '召喚已啟用，等待重新施放。' : '目前沒有' + labels[activeType] + '。';
            var content = list.length ? list.map(function (x) { return rowHtml(activeType, x); }).join('') : '<div class="afk-squad-empty">' + empty + '</div>';
            if (activeType === 'pet') {
                var slot = ''; try { slot = String(currentSlot); } catch (e) {}
                var deployed = list.filter(function (x) { return String(x.outSlot) === slot; });
                var reserve = list.filter(function (x) { return String(x.outSlot) !== slot; });
                var otherOut = reserve.filter(function (x) { return x.outSlot != null; }).length, stored = reserve.length - otherOut;
                var deployedHtml = deployed.length ? deployed.map(function (x) { return rowHtml('pet', x); }).join('') : '<div class="afk-squad-empty compact">目前沒有出戰寵物。</div>';
                var reserveHtml = reserve.map(function (x) { return rowHtml('pet', x); }).join('');
                content = '<section class="afk-pet-active-group"><div class="afk-pet-group-label"><b>⚔️ 出戰寵物</b><small>' + deployed.length + ' 隻</small></div>' + deployedHtml + '</section>' +
                    (reserve.length ? '<section class="afk-pet-reserve-group"><button type="button" class="afk-pet-reserve-toggle" data-afk-pet-reserve-toggle aria-expanded="' + (reserveOpen ? 'true' : 'false') + '"><span><b>📦 其餘寵物</b><small>其他角色 ' + otherOut + '・保管中 ' + stored + '</small></span><em>' + reserve.length + ' 隻 ' + (reserveOpen ? '▾' : '▸') + '</em></button><div class="afk-pet-reserve-body"' + (reserveOpen ? '' : ' hidden') + '>' + reserveHtml + '</div></section>' : '');
            }
            root.innerHTML = '<div class="afk-squad-typebar">' + tabCount('mercenary', data.mercenary) + tabCount('pet', data.pet) + tabCount('summon', data.summon) + '</div><div class="afk-squad-type-summary"><span>' + icons[activeType] + ' ' + labels[activeType] + '</span><small>共 ' + list.length + '・出戰 ' + active + (down ? '・倒地 ' + down : '') + '</small></div><div class="afk-squad-list' + (activeType === 'pet' ? ' pet-mode' : '') + '">' + content + '</div>';
        }
        function findRow(uid) {
            var root = document.getElementById('squad-tab-team'); if (!root) return null;
            var rows = root.querySelectorAll('[data-afk-squad-uid]');
            for (var i = 0; i < rows.length; i++) if (rows[i].dataset.afkSquadUid === uid) return rows[i];
            return null;
        }
        function setVital(row, key, cur, max) {
            max = Math.max(1, Math.floor(Number(max || 1))); cur = Math.max(0, Math.floor(Number(cur || 0)));
            var bar = row.querySelector('[data-afk-bar="' + key + '"]'); if (bar) bar.style.width = pct(cur, max) + '%';
            var text = row.querySelector('[data-afk-text="' + key + '"]'); if (text) text.textContent = cur + '/' + max;
        }
        function patchValues(data) {
            (data[activeType] || []).forEach(function (item) {
                var uid = itemUid(activeType, item), row = findRow(uid); if (!row) return;
                var hp = Number(activeType === 'mercenary' ? item.curHp : item.hp) || 0, mhp = Math.max(1, Number(item.mhp || 1));
                var mini = row.querySelector('[data-afk-mini-hp]'); if (mini) mini.style.width = pct(hp, mhp) + '%';
                var mt = row.querySelector('[data-afk-mini-text]'); if (mt) mt.textContent = Math.floor(hp) + '/' + Math.floor(mhp);
                if (uid !== expandedUid) return;
                setVital(row, 'hp', hp, mhp);
                if (activeType === 'mercenary') {
                    setVital(row, 'mp', item.mp, item.mmp);
                    var req = typeof getExpReq === 'function' ? Number(getExpReq(item.lv || 1) || 0) : 0, ep = req > 0 ? Math.min(100, Math.max(0, Number(item.exp || 0) / req * 100)) : 0;
                    var eb = row.querySelector('[data-afk-bar="exp"]'); if (eb) eb.style.width = ep + '%'; var et = row.querySelector('[data-afk-text="exp"]'); if (et) et.textContent = ep.toFixed(1) + '%';
                    var st = row.querySelector('[data-afk-state]'); if (st) st.textContent = statusText(item);
                    var rv = row.querySelector('[data-afk-merc-revive]'); if (rv) rv.textContent = Number(item._reviveCd || 0) > 0 ? ('自動 ' + Math.ceil(item._reviveCd / 10) + ' 秒') : '等待復活卷軸';
                } else if (activeType === 'pet') {
                    var d = null; try { d = typeof petDerive === 'function' ? petDerive(item) : null; } catch (e) {}
                    setVital(row, 'mp', item.mp, Number(item.mmp || 0) + Number(d && d.mmpBonus || 0));
                    var pr = typeof petExpReq === 'function' ? Number(petExpReq(item.lv || 1) || 0) : 0, pp = pr > 0 ? Math.min(100, Math.max(0, Number(item.exp || 0) / pr * 100)) : 0;
                    var pb = row.querySelector('[data-afk-bar="exp"]'); if (pb) pb.style.width = pp + '%'; var pt = row.querySelector('[data-afk-text="exp"]'); if (pt) pt.textContent = pp.toFixed(1) + '%';
                } else {
                    var sid = item.skId || (typeof summonV2ActiveSk === 'function' ? summonV2ActiveSk() : ''), remain = Math.max(0, Math.ceil(Number(player && player.buffs && player.buffs[sid] || 0)));
                    var tm = row.querySelector('[data-afk-summon-time]'); if (tm) tm.textContent = Math.floor(remain / 60) + ':' + String(remain % 60).padStart(2, '0');
                }
            });
        }
        function flush() {
            renderRaf = 0;
            try { if (typeof state !== 'undefined' && state.ff) return; } catch (e) {}
            if (typeof player === 'undefined' || !player) return;
            if (playerRef !== player) { playerRef = player; expandedUid = ''; lastSkillSig = ''; lastTeamSig = ''; }
            var panel = document.getElementById('squad-panel'), team = document.getElementById('squad-tab-team'); if (!panel || !team) return;
            var data = collect(), any = data.mercenary.length || data.pet.length || data.summon.length || data.summonConfigured;
            panel.style.display = any ? '' : 'none'; if (!any) return;
            var ss = skillSignature(data.mercenary), skillHost = document.getElementById('squad-tab-skill');
            if (ss !== lastSkillSig || !skillHost || !skillHost.children.length) {
                lastSkillSig = ss;
                try { original(); } catch (e) { console.warn('[AFK] Squad original render', e); }
                // 原生渲染會重建隊伍頁，必須重新套用精簡分類版面。
                lastTeamSig = '';
            }
            var current = data[activeType] || [];
            if (expandedUid && !current.some(function (x) { return itemUid(activeType, x) === expandedUid; })) expandedUid = '';
            var ts = structuralSignature(data);
            if (ts !== lastTeamSig) { lastTeamSig = ts; rebuildTeam(data); }
            patchValues(data);
        }
        function queue() { AFKRuntime.schedule('squad:render', flush); }
        function install() {
            original = AFKRuntime.hooks.original('renderSquadPanel');
            AFKRuntime.hooks.intercept('renderSquadPanel', 'squad-layout', function () { queue(); });
            queue();
        }
        document.addEventListener('click', function (e) {
            var reserveToggle = e.target.closest && e.target.closest('[data-afk-pet-reserve-toggle]');
            if (reserveToggle) {
                e.preventDefault(); e.stopPropagation();
                reserveOpen = !reserveOpen;
                localStorage.setItem(PET_GROUP_KEY, String(reserveOpen));
                reserveToggle.setAttribute('aria-expanded', reserveOpen ? 'true' : 'false');
                var reserveGroup = reserveToggle.closest('.afk-pet-reserve-group');
                var reserveBody = reserveGroup && reserveGroup.querySelector('.afk-pet-reserve-body');
                if (reserveBody) reserveBody.hidden = !reserveOpen;
                var reserveCount = reserveToggle.querySelector('em');
                if (reserveCount) reserveCount.textContent = reserveCount.textContent.replace(/[▾▸]\s*$/, reserveOpen ? '▾' : '▸');
                try { reserveToggle.focus({ preventScroll: true }); } catch (focusError) {}
                return;
            }
            var tab = e.target.closest && e.target.closest('[data-afk-squad-tab]');
            if (tab) { e.preventDefault(); e.stopPropagation(); activeType = tab.dataset.afkSquadTab; localStorage.setItem(KEY, activeType); expandedUid = ''; lastTeamSig = ''; queue(); return; }
            var action = e.target.closest && e.target.closest('[data-afk-squad-act]');
            if (action) {
                e.preventDefault(); e.stopPropagation();
                var act = action.dataset.afkSquadAct;
                if (act === 'merc-rez' && typeof reviveMercenary === 'function') reviveMercenary(action.dataset.slot, 'rez');
                else if (act === 'merc-switch' && typeof switchToAllyChar === 'function') switchToAllyChar(action.dataset.slot);
                else if (act === 'pet-rez' && typeof petRevive === 'function') petRevive(action.dataset.uid, action.dataset.mode);
                else if (act === 'pet-gear' && typeof petGearOpen === 'function') petGearOpen(action.dataset.uid, action.dataset.slot);
                else if (act === 'pet-deploy' && typeof petDeployToggle === 'function') petDeployToggle(action.dataset.uid);
                else if (act === 'pet-evolve' && typeof petEvolve === 'function') petEvolve(action.dataset.uid);
                else if (act === 'pet-lock' && typeof petToggleLock === 'function') petToggleLock(action.dataset.uid);
                else if (act === 'pet-release') {
                    var releasePet = function () { if (typeof petReleaseConfirm === 'function') petReleaseConfirm(action.dataset.uid, true); lastTeamSig = ''; queue(); };
                    var pet = null; try { pet = typeof petRoster === 'function' ? petRoster().filter(function (x) { return String(x.uid) === String(action.dataset.uid); })[0] : null; } catch (e) {}
                    var message = '確定要放生「' + (pet ? petName(pet) : '這隻寵物') + '」嗎？放生後將永久消失。';
                    if (typeof gameConfirm === 'function') gameConfirm({ title:'放生寵物', message:message, okText:'確定放生', danger:true, onOk:releasePet });
                    else if (window.confirm(message)) releasePet();
                }
                else if (act === 'summon-recast' && typeof summonV2Recast === 'function') summonV2Recast();
                lastTeamSig = ''; AFKRuntime.schedule('squad:action', queue); return;
            }
            var expand = e.target.closest && e.target.closest('[data-afk-squad-expand]');
            if (expand) { e.preventDefault(); expandedUid = expandedUid === expand.dataset.afkSquadExpand ? '' : expand.dataset.afkSquadExpand; lastTeamSig = ''; queue(); return; }
            if (e.target.closest && e.target.closest('#squad-tab-btn-team')) setTimeout(queue, 0);
        });
        document.addEventListener('change', function (e) {
            if (!e.target || !e.target.dataset || !e.target.dataset.afkPetPot) return;
            if (typeof petSetPotPct === 'function') petSetPotPct(e.target.dataset.afkPetPot, e.target.value);
            queue();
        });
        var style = document.createElement('style');
        style.textContent = '#squad-tab-team{gap:6px!important}.afk-squad-typebar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;position:sticky;top:0;z-index:3;padding:2px 0 5px;background:#111827}.afk-squad-typebar button{min-width:0;display:flex;align-items:center;justify-content:center;gap:3px;padding:5px 3px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#cbd5e1;font:700 10px system-ui;cursor:pointer}.afk-squad-typebar button.active{border-color:#f59e0b;background:linear-gradient(135deg,#92400e,#b45309);color:#fff}.afk-squad-typebar button b{min-width:16px;padding:1px 4px;border-radius:8px;background:#0f172a;color:#f8fafc;font-size:9px}.afk-squad-typebar button em{color:#fca5a5;font:700 8px system-ui}.afk-squad-type-summary{display:flex;align-items:center;justify-content:space-between;padding:3px 2px;color:#fcd34d;font:800 11px system-ui}.afk-squad-type-summary small{color:#94a3b8;font-size:9px}.afk-squad-list{display:flex;flex-direction:column;gap:4px}.afk-squad-row{overflow:hidden;border:1px solid #475569;border-radius:8px;background:rgba(30,41,59,.82)}.afk-squad-row.pet{border-color:#0f766e}.afk-squad-row.summon{border-color:#6d28d9}.afk-squad-row.downed{border-color:#991b1b;filter:saturate(.75)}.afk-squad-summary{width:100%;display:grid;grid-template-columns:28px minmax(0,1fr) 72px 12px;align-items:center;gap:5px;padding:5px 6px;border:0;background:transparent;color:#e2e8f0;text-align:left;cursor:pointer}.afk-squad-summary img,.afk-squad-avatar{width:26px;height:24px;display:flex;align-items:center;justify-content:center;object-fit:contain;image-rendering:pixelated;font-size:16px}.afk-squad-name{min-width:0;display:flex;flex-direction:column}.afk-squad-name b,.afk-squad-name small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.afk-squad-name b{color:#fde68a;font-size:11px}.afk-squad-row.pet .afk-squad-name b{color:#6ee7b7}.afk-squad-row.summon .afk-squad-name b{color:#c4b5fd}.afk-squad-name small{color:#94a3b8;font-size:9px}.afk-squad-mini{display:flex;flex-direction:column;gap:1px;text-align:center}.afk-squad-mini i,.afk-squad-vital i{position:relative;overflow:hidden;height:7px;border-radius:5px;background:#0f172a}.afk-squad-mini i b,.afk-squad-vital i b{display:block;height:100%;background:linear-gradient(90deg,#b91c1c,#f87171)}.afk-squad-mini small{color:#cbd5e1;font-size:8px}.afk-squad-arrow{color:#94a3b8}.afk-squad-detail{display:flex;flex-direction:column;gap:4px;padding:4px 7px 7px;border-top:1px solid rgba(71,85,105,.65)}.afk-squad-vital{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:4px;color:#94a3b8;font:700 9px system-ui}.afk-squad-vital i{height:13px}.afk-squad-vital i b[data-afk-bar="mp"]{background:linear-gradient(90deg,#1d4ed8,#60a5fa)}.afk-squad-vital i b[data-afk-bar="exp"]{background:linear-gradient(90deg,#ca8a04,#fde047)}.afk-squad-vital em{position:absolute;inset:0;color:#fff;text-align:center;font:700 8px/13px system-ui}.afk-squad-actions{display:flex;gap:4px;align-items:center}.afk-squad-actions button,.afk-squad-switch{flex:1;padding:4px 6px;border:1px solid #0f766e;border-radius:5px;background:#065f46;color:#d1fae5;font:800 9px system-ui;cursor:pointer}.afk-squad-actions span{color:#fca5a5;font-size:9px}.afk-squad-switch.summon{border-color:#7c3aed;background:#4c1d95;color:#ede9fe}.afk-squad-threshold,.afk-squad-note{color:#cbd5e1;font-size:9px}.afk-squad-threshold input{width:42px;padding:2px;border:1px solid #475569;border-radius:4px;background:#0f172a;color:#fff;text-align:center}.afk-squad-empty{padding:18px 8px;border:1px dashed #475569;border-radius:8px;color:#64748b;text-align:center;font-size:10px}@media(max-width:900px){.afk-squad-summary{grid-template-columns:24px minmax(0,1fr) 62px 10px}.afk-squad-typebar button{font-size:9px}}';
        style.textContent += '.afk-squad-owner{padding:5px 6px;border:1px solid #0369a1;border-radius:6px;background:#0c4a6e;color:#bae6fd;font:700 8px/1.4 system-ui}.afk-pet-manage{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.afk-pet-manage button{min-width:0;padding:5px 3px;border:1px solid #475569;border-radius:6px;background:#1e293b;color:#cbd5e1;font:800 8px system-ui;cursor:pointer}.afk-pet-manage .gear.equipped{border-color:#f59e0b;color:#fde68a;background:#713f12}.afk-pet-manage .deploy{border-color:#10b981;background:#065f46;color:#d1fae5}.afk-pet-manage .evolve{border-color:#eab308;background:#854d0e;color:#fef9c3}.afk-pet-manage .lock.active{border-color:#f59e0b;background:#78350f;color:#fef3c7}.afk-pet-manage .release{border-color:#ef4444;background:#7f1d1d;color:#fecaca}.afk-squad-row.pet:not(.downed) .afk-squad-summary:hover{background:rgba(15,118,110,.15)}';
        style.textContent += '.afk-pet-active-group,.afk-pet-reserve-group{display:flex;flex-direction:column;gap:4px}.afk-pet-active-group{overflow:hidden;padding:5px;border:1px solid rgba(16,185,129,.55);border-radius:9px;background:rgba(6,78,59,.16);overflow-anchor:none}.afk-pet-group-label{display:flex;align-items:center;justify-content:space-between;padding:1px 3px;color:#6ee7b7;font:800 9px system-ui}.afk-pet-group-label small{color:#94a3b8;font-size:8px}.afk-squad-empty.compact{padding:9px}.afk-pet-reserve-group{overflow:hidden;border:1px solid #334155;border-radius:9px;background:rgba(15,23,42,.55);overflow-anchor:none}.afk-pet-reserve-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border:0;background:linear-gradient(135deg,#1e293b,#172033);color:#e2e8f0;text-align:left;cursor:pointer}.afk-pet-reserve-toggle:hover{background:#26354a}.afk-pet-reserve-toggle>span{display:flex;flex-direction:column;gap:2px}.afk-pet-reserve-toggle b{color:#cbd5e1;font-size:10px}.afk-pet-reserve-toggle small{color:#94a3b8;font-size:8px}.afk-pet-reserve-toggle em{color:#fcd34d;font:800 8px system-ui;white-space:nowrap}.afk-pet-reserve-body{display:flex;flex-direction:column;gap:4px;padding:5px;border-top:1px solid #334155}.afk-pet-reserve-body[hidden]{display:none!important}';
        document.head.appendChild(style);
        AFKRuntime.when('squad:lifecycle', function () { return typeof window.renderSquadPanel === 'function' && document.getElementById('squad-tab-team'); }, install);
    }

    // ============================================================
    //  🔮 系統日誌旁的潘朵拉商品櫥窗
    // ============================================================
    function initPandoraDockModuleLegacy() {
        var KEY = 'afk_pandora_dock_open', opened = localStorage.getItem(KEY) !== 'false';
        var dock = null, toggle = null, castleButton = null, pledgeButton = null, lastSig = '';
        function market() { try { return player && player.pandoraMarket2; } catch (e) { return null; } }
        function signature() {
            var m = market();
            if (!m || !Array.isArray(m.slots)) return '';
            return m.slots.map(function (s) { return s ? [s.id, s.price, s.sold ? 1 : 0, s.weight].join(':') : '-'; }).join('|');
        }
        function syncState() {
            if (!dock || !toggle) return;
            dock.classList.toggle('hidden', !opened);
            toggle.classList.toggle('active', opened);
            toggle.textContent = opened ? '🔮 隱藏黑市' : '🔮 顯示黑市';
            toggle.setAttribute('aria-expanded', opened ? 'true' : 'false');
            if (opened) render(true);
        }
        function render(force) {
            if (!opened || !dock || typeof DB === 'undefined' || !DB.items) return;
            var m = market(), sig = signature();
            if (!force && sig === lastSig) {
                var goldLabel = dock.querySelector('.afk-pandora-dock-head span');
                if (goldLabel) goldLabel.textContent = '金幣 ' + Number(player && player.gold || 0).toLocaleString();
                Array.prototype.forEach.call(dock.querySelectorAll('[data-afk-pandora-price]'), function (button) { if (button.dataset.afkPandoraSold !== '1') button.disabled = Number(player && player.gold || 0) < Number(button.dataset.afkPandoraPrice || 0); });
                return;
            }
            lastSig = sig; dock.replaceChildren();
            var head = document.createElement('div'); head.className = 'afk-pandora-dock-head';
            head.innerHTML = '<b>🔮 潘朵拉黑市</b><span>金幣 ' + Number(player && player.gold || 0).toLocaleString() + '</span>';
            dock.appendChild(head);
            var list = document.createElement('div'); list.className = 'afk-pandora-dock-list'; dock.appendChild(list);
            if (!m || !Array.isArray(m.slots) || !m.slots.length) { var empty = document.createElement('div'); empty.className = 'afk-pandora-dock-empty'; empty.textContent = '黑市商品讀取中…'; list.appendChild(empty); return; }
            m.slots.forEach(function (slot, index) {
                var d = slot && DB.items[slot.id]; if (!d) return;
                var card = document.createElement('div'); card.className = 'afk-pandora-dock-item' + (slot.sold ? ' sold' : '') + (slot.weight === 1 ? ' rare' : ''); card.dataset.afkPandoraId = slot.id;
                var icon = document.createElement('img'); icon.alt = ''; try { icon.src = getIconUrl(d); } catch (e) {}
                var body = document.createElement('span'), name = document.createElement('b'), price = document.createElement('small');
                name.textContent = d.n || slot.id; price.textContent = Number(slot.price || 0).toLocaleString() + ' 金幣'; body.appendChild(name); body.appendChild(price);
                var buy = document.createElement('button'); buy.type = 'button'; buy.textContent = slot.sold ? '售出' : '購買'; buy.disabled = !!slot.sold || Number(player.gold || 0) < Number(slot.price || 0);
                buy.dataset.afkPandoraPrice = String(Number(slot.price || 0)); buy.dataset.afkPandoraSold = slot.sold ? '1' : '0';
                buy.onclick = function (e) { e.stopPropagation(); if (typeof buyPandoraItem === 'function') buyPandoraItem(index); setTimeout(function () { render(true); }, 0); };
                card.appendChild(icon); card.appendChild(body); card.appendChild(buy);
                card.addEventListener('mouseenter', function (e) { if (typeof pandoraTipShow === 'function') pandoraTipShow(e, index); });
                card.addEventListener('mousemove', function (e) { if (typeof pandoraTipMove === 'function') pandoraTipMove(e); });
                card.addEventListener('mouseleave', function () { if (typeof pandoraTipHide === 'function') pandoraTipHide(); });
                list.appendChild(card);
            });
        }
        function showInteraction(title, subtitle) {
            var npc = document.getElementById('town-npc-container'), interaction = document.getElementById('town-interaction-container'), content = document.getElementById('interaction-content');
            if (npc) npc.classList.add('hidden'); if (interaction) { interaction.classList.remove('hidden'); interaction.classList.add('flex'); }
            var name = document.getElementById('interaction-npc-name'); if (name) name.textContent = title || '';
            var type = document.getElementById('interaction-npc-title') || document.getElementById('interaction-npc-type'); if (type) type.textContent = subtitle ? ('[' + subtitle + ']') : '';
            if (content) content.replaceChildren(); return content;
        }
        function openPledge() {
            var content = showInteraction('血盟', player && player.bloodPledge ? '盟務' : '選擇陣營'); if (!content) return;
            if (player && player.bloodPledge && typeof renderPledgeNPC === 'function') { renderPledgeNPC(content, player.bloodPledge); return; }
            var box = document.createElement('div'); box.className = 'afk-system-choice';
            var title = document.createElement('h3'); title.textContent = '選擇想加入的血盟'; box.appendChild(title);
            [['esti','🛡️ 依詩蒂血盟'],['tros','⚔️ 特羅斯血盟']].forEach(function (row) {
                var b = document.createElement('button'); b.type = 'button'; b.textContent = row[1]; b.onclick = function () { if (typeof renderPledgeNPC === 'function') renderPledgeNPC(content, row[0]); }; box.appendChild(b);
            });
            content.appendChild(box);
        }
        function openCastle() {
            if (!player || !player.bloodPledge) { openPledge(); return; }
            var content = showInteraction('城堡與攻城戰', '血盟戰役'); if (!content) return;
            var siege = player.siege || {}, city = siege.city || siege.victoryCity || 'kent';
            if (siege.active) {
                var cfg = typeof SIEGE_CITY !== 'undefined' && SIEGE_CITY[city], box = document.createElement('div'); box.className = 'afk-system-choice';
                var h = document.createElement('h3'); h.textContent = '⚔️ 攻城戰進行中：' + (cfg && cfg.name || city); box.appendChild(h);
                var p = document.createElement('p'); p.textContent = '擊殺數 ' + Number(siege.kills || 0) + '，點擊下方按鈕返回目前戰場。'; box.appendChild(p);
                var b = document.createElement('button'); b.type = 'button'; b.textContent = '前往攻城戰'; b.onclick = function () { var map = siege.gateKilled && cfg ? cfg.inner : (cfg && cfg.outer); if (map && typeof setMapSelectors === 'function') setMapSelectors(map); if (typeof changeMap === 'function') changeMap(true); }; box.appendChild(b); content.appendChild(box); return;
            }
            if ((siege.victoryUntil || 0) > Date.now() && typeof renderCastleGuard === 'function') { renderCastleGuard(content, siege.victoryCity || 'kent'); return; }
            if (typeof openSiegeSelect === 'function') openSiegeSelect(player.bloodPledge);
        }
        function ensure() {
            var panel = document.getElementById('syslog-panel'); if (!panel) return;
            var header = panel.querySelector('.panel-header'), created = false;
            if ((!toggle || !toggle.isConnected) && header) {
                toggle = document.createElement('button'); toggle.id = 'afk-pandora-toggle'; toggle.type = 'button';
                toggle.onclick = function (e) { e.stopPropagation(); opened = !opened; localStorage.setItem(KEY, String(opened)); syncState(); };
                castleButton = document.createElement('button'); castleButton.id = 'afk-castle-toggle'; castleButton.type = 'button'; castleButton.textContent = '🏰 城堡'; castleButton.onclick = function (e) { e.stopPropagation(); openCastle(); };
                pledgeButton = document.createElement('button'); pledgeButton.id = 'afk-pledge-toggle'; pledgeButton.type = 'button'; pledgeButton.textContent = '🛡️ 血盟'; pledgeButton.onclick = function (e) { e.stopPropagation(); openPledge(); };
                header.appendChild(castleButton); header.appendChild(pledgeButton); header.appendChild(toggle); created = true;
            }
            if (!dock || !dock.isConnected) { dock = document.createElement('aside'); dock.id = 'afk-pandora-dock'; panel.appendChild(dock); created = true; }
            if (created) syncState();
        }
        function hook(name) {
            var fn = window[name]; if (typeof fn !== 'function' || fn.__afkPandoraDock) return false;
            window[name] = function () { var result = fn.apply(this, arguments); try { render(true); } catch (e) {} return result; };
            window[name].__afkPandoraDock = true; return true;
        }
        function install() { ensure(); hook('refreshPandoraMarket'); hook('buyPandoraItem'); render(false); if (!dock) setTimeout(install, 800); }
        document.addEventListener('pointerdown', function (e) {
            if (!opened || !dock || !toggle) return;
            if (dock.contains(e.target) || toggle.contains(e.target) || (e.target.closest && e.target.closest('#pandora-tooltip,.pandora-tooltip'))) return;
            opened = false; localStorage.setItem(KEY, 'false'); syncState();
        }, true);
        window.addEventListener('afk-open-pandora-item', function (e) {
            ensure(); opened = true; localStorage.setItem(KEY, 'true'); syncState();
            var id = e.detail && e.detail.id, card = id && dock && dock.querySelector('[data-afk-pandora-id="' + String(id).replace(/"/g, '') + '"]');
            if (card) { card.classList.add('afk-pandora-highlight'); card.scrollIntoView({ block:'nearest', behavior:'smooth' }); setTimeout(function () { card.classList.remove('afk-pandora-highlight'); }, 1800); }
        });
        setTimeout(install, 1500);
    }

    // ============================================================
    //  🧭 城堡／血盟／黑市共用快捷視窗
    // ============================================================
    function initPandoraDockModule() {
        var TYPE_KEY = 'afk_system_dock_type', OLD_KEY = 'afk_pandora_dock_open';
        var activeType = localStorage.getItem(TYPE_KEY);
        if (activeType == null) activeType = localStorage.getItem(OLD_KEY) === 'false' ? '' : 'pandora';
        if (['', 'castle', 'pledge', 'pandora'].indexOf(activeType) < 0) activeType = '';
        var dock = null, buttons = {}, lastSig = '', shortcutGroup = null, castleSelectorOpen = false;

        function market() { try { return player && player.pandoraMarket2; } catch (e) { return null; } }
        function cityConfig(key) { try { return typeof SIEGE_CITY !== 'undefined' && SIEGE_CITY[key] ? SIEGE_CITY[key] : null; } catch (e) { return null; } }
        function pledgeConfig(key) { try { return typeof PLEDGE_CFG !== 'undefined' && PLEDGE_CFG[key] ? PLEDGE_CFG[key] : null; } catch (e) { return null; } }
        function blessingDefs() { try { return typeof BLESSING_DEFS !== 'undefined' ? BLESSING_DEFS : {}; } catch (e) { return {}; } }
        function countItem(id) {
            try { return (player.inv || []).reduce(function (sum, item) { return sum + (item && item.id === id ? Number(item.cnt || 0) : 0); }, 0); } catch (e) { return 0; }
        }
        function remainText(ms) {
            var sec = Math.max(0, Math.ceil(Number(ms || 0) / 1000)), h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
            return h > 0 ? (h + ' 小時 ' + m + ' 分') : (m + ':' + String(s).padStart(2, '0'));
        }
        function saveType(type) {
            activeType = type || ''; lastSig = '';
            localStorage.setItem(TYPE_KEY, activeType);
            localStorage.setItem(OLD_KEY, activeType === 'pandora' ? 'true' : 'false');
        }
        function setType(type) { saveType(activeType === type ? '' : type); syncState(true); }
        function showInteraction(title, subtitle) {
            var npc = document.getElementById('town-npc-container'), interaction = document.getElementById('town-interaction-container'), content = document.getElementById('interaction-content');
            if (npc) npc.classList.add('hidden');
            if (interaction) { interaction.classList.remove('hidden'); interaction.classList.add('flex'); }
            var name = document.getElementById('interaction-npc-name'); if (name) name.textContent = title || '';
            var type = document.getElementById('interaction-npc-title') || document.getElementById('interaction-npc-type'); if (type) type.textContent = subtitle ? ('[' + subtitle + ']') : '';
            if (content) content.replaceChildren();
            return content;
        }
        function openCastleGuardShortcut() {
            var siege = player && player.siege || {}, city = siege.victoryCity || '';
            if (!city || Number(siege.victoryUntil || 0) <= Date.now()) { if (typeof logSys === 'function') logSys('<span class="text-red-400">目前沒有可管理的城堡護衛。</span>'); return; }
            var cfg = cityConfig(city), content = showInteraction('城堡護衛', cfg ? cfg.name : '城堡'); if (!content) return;
            if (typeof renderCastleGuard === 'function') renderCastleGuard(content, city);
            saveType(''); syncState(true);
        }
        function openMonsterTrackingShortcut() {
            var content = showInteraction('魔物追蹤', '遠端委託'); if (!content) return;
            if (typeof renderObelNPC === 'function') renderObelNPC(content);
            saveType(''); syncState(true);
        }
        function castleServicesHtml(hasVictory) {
            return '<section class="afk-castle-remote"><b>城堡服務</b><div><button type="button" data-afk-dock-act="castle-guard"' + (hasVictory ? '' : ' disabled') + '>🛡️ 城堡護衛<small>' + (hasVictory ? '管理目前城堡護衛' : '需先取得城堡') + '</small></button><button type="button" data-afk-dock-act="castle-track">🎯 魔物追蹤<small>任何地圖皆可使用</small></button></div></section>';
        }
        function castleBlockReason(siege) {
            if (!player || !player.bloodPledge) return '尚未加入血盟';
            if (siege.active) return '攻城戰正在進行中';
            if (siege.rewardPending) return '請先領取攻城獎勵';
            var cd = Number(siege.cooldownUntil || 0) - Date.now(); if (cd > 0) return '冷卻尚餘 ' + remainText(cd);
            if (Number(player.lv || 1) < 40) return '需要等級 40';
            if (countItem('new_item_241') < 10) return '王族搜索狀不足 10 張';
            return '';
        }
        function castleSelectorHtml(siege) {
            if (!castleSelectorOpen) return '';
            var reason = castleBlockReason(siege), disabled = reason ? ' disabled' : '';
            return '<section class="afk-castle-selector"><b>選擇下一座攻打城堡</b><small>' + (reason || '選擇後仍會顯示正式開戰確認') + '</small><div><button type="button" data-afk-dock-act="castle-start" data-city="kent"' + disabled + '>🏰 肯特城</button><button type="button" data-afk-dock-act="castle-start" data-city="windwood"' + disabled + '>🌲 風木城</button><button type="button" data-afk-dock-act="castle-start" data-city="heine"' + disabled + '>🌊 海音城</button></div></section>';
        }
        function commonHead(icon, title, meta) {
            dock.replaceChildren();
            var head = document.createElement('div'); head.className = 'afk-system-dock-head';
            var left = document.createElement('b'); left.textContent = icon + ' ' + title;
            var right = document.createElement('span'); right.textContent = meta || '';
            head.appendChild(left); head.appendChild(right); dock.appendChild(head);
            var body = document.createElement('div'); body.className = 'afk-system-dock-body'; dock.appendChild(body); return body;
        }
        function renderPandora() {
            var body = commonHead('🔮', '潘朵拉黑市', '金幣 ' + Number(player && player.gold || 0).toLocaleString());
            body.classList.add('afk-pandora-dock-list');
            var m = market();
            if (!m || !Array.isArray(m.slots) || !m.slots.length) { var empty = document.createElement('div'); empty.className = 'afk-pandora-dock-empty'; empty.textContent = '黑市商品讀取中…'; body.appendChild(empty); return; }
            m.slots.forEach(function (slot, index) {
                var d = slot && typeof DB !== 'undefined' && DB.items && DB.items[slot.id]; if (!d) return;
                var card = document.createElement('div'); card.className = 'afk-pandora-dock-item' + (slot.sold ? ' sold' : '') + (slot.weight === 1 ? ' rare' : ''); card.dataset.afkPandoraId = slot.id;
                var icon = document.createElement('img'); icon.alt = ''; try { icon.src = getIconUrl(d); } catch (e) {}
                var text = document.createElement('span'), name = document.createElement('b'), price = document.createElement('small');
                name.textContent = d.n || slot.id; price.textContent = Number(slot.price || 0).toLocaleString() + ' 金幣'; text.appendChild(name); text.appendChild(price);
                var buy = document.createElement('button'); buy.type = 'button'; buy.textContent = slot.sold ? '售出' : '購買'; buy.disabled = !!slot.sold || Number(player.gold || 0) < Number(slot.price || 0);
                buy.onclick = function (e) { e.stopPropagation(); if (typeof buyPandoraItem === 'function') buyPandoraItem(index); AFKRuntime.schedule('dock:pandora', function () { lastSig = ''; render(); }); };
                card.appendChild(icon); card.appendChild(text); card.appendChild(buy);
                card.addEventListener('mouseenter', function (e) { if (typeof pandoraTipShow === 'function') pandoraTipShow(e, index); });
                card.addEventListener('mousemove', function (e) { if (typeof pandoraTipMove === 'function') pandoraTipMove(e); });
                card.addEventListener('mouseleave', function () { if (typeof pandoraTipHide === 'function') pandoraTipHide(); });
                body.appendChild(card);
            });
        }
        function actionButton(text, action, extra) {
            return '<button type="button" class="afk-dock-action ' + (extra || '') + '" data-afk-dock-act="' + action + '">' + text + '</button>';
        }
        function renderCastle() {
            var siege = player && player.siege || {}, cfg = cityConfig(siege.city || siege.victoryCity || 'kent');
            var hasVictory = Number(siege.victoryUntil || 0) > Date.now() && !!siege.victoryCity;
            var services = castleServicesHtml(hasVictory), selector = castleSelectorHtml(siege);
            var body = commonHead('🏰', '城堡與攻城戰', player && player.bloodPledge ? ((pledgeConfig(player.bloodPledge) || {}).pledgeName || '已加入血盟') : '尚未加入血盟');
            if (!player || !player.bloodPledge) {
                body.innerHTML = '<div class="afk-dock-empty-state"><b>需要先加入血盟</b><span>加入依詩蒂或特羅斯血盟後，才能參與攻城戰。</span>' + actionButton('前往選擇血盟', 'switch-pledge', 'primary') + '</div>' + selector + services; return;
            }
            if (siege.active) {
                var rem = Number(siege.endTime || 0) - Date.now();
                body.innerHTML = '<div class="afk-dock-status danger"><b>⚔️ ' + (cfg ? cfg.name : '攻城戰') + '進行中</b><strong>' + remainText(rem) + '</strong></div><div class="afk-dock-progress"><span>擊殺數 <b>' + Number(siege.kills || 0) + '</b></span><span class="' + (siege.gateKilled ? 'done' : '') + '">城門 ' + (siege.gateKilled ? '完成' : '未破') + '</span><span class="' + (siege.towerKilled ? 'done' : '') + '">守護塔 ' + (siege.towerKilled ? '完成' : '未破') + '</span></div>' + actionButton('前往目前戰場', 'castle-travel', 'primary') + selector + services; return;
            }
            if (siege.rewardPending) {
                body.innerHTML = '<div class="afk-dock-status"><b>🏆 攻城結果待領賞</b><strong>' + (siege.result === 'win' ? '勝利' : '已結束') + '</strong></div>' + actionButton('領取攻城獎勵', 'castle-reward', 'primary') + selector + services; return;
            }
            if (hasVictory) {
                var vc = cityConfig(siege.victoryCity || 'kent'), guard = player.castleGuard;
                body.innerHTML = '<button type="button" class="afk-dock-status success afk-castle-owner" data-afk-dock-act="castle-select-toggle" aria-expanded="' + (castleSelectorOpen ? 'true' : 'false') + '"><b>👑 擁有 ' + (vc ? vc.name : '城堡') + '</b><strong>' + remainText(Number(siege.victoryUntil || 0) - Date.now()) + '</strong><small>點擊選擇下一座攻打城堡</small></button><div class="afk-dock-info">城堡護衛：<b>' + (guard ? guard.name : '尚未雇用') + '</b></div>' + selector + services; return;
            }
            var cd = Number(siege.cooldownUntil || 0) - Date.now(), warrants = countItem('new_item_241');
            castleSelectorOpen = true; selector = castleSelectorHtml(siege);
            body.innerHTML = '<div class="afk-dock-info"><span>王族搜索狀 <b>' + warrants + '</b>／10</span><span>等級 <b>' + Number(player.lv || 1) + '</b></span><span>' + (cd > 0 ? ('冷卻 ' + remainText(cd)) : '可宣布攻城') + '</span></div>' + selector + services;
        }
        function renderPledge() {
            var faction = player && player.bloodPledge, cfg = pledgeConfig(faction), body = commonHead('🛡️', '血盟快捷', cfg ? cfg.pledgeName : '尚未選擇陣營');
            if (!faction) {
                body.innerHTML = '<div class="afk-dock-empty-state"><b>選擇效忠陣營</b><span>加入後會與另一陣營敵對，原遊戲仍會檢查等級與職業限制。</span><div class="afk-dock-grid">' + actionButton('🛡️ 依詩蒂血盟', 'pledge-join', 'esti primary') + actionButton('⚔️ 特羅斯血盟', 'pledge-join', 'tros danger') + '</div></div>'; return;
            }
            var defs = blessingDefs(), blessings = Object.keys(defs).map(function (key) {
                var def = defs[key] || {}, active = Number(player.blessings && player.blessings[key] || 0) > Date.now(), auto = !!(player.blessingAuto && player.blessingAuto[key]);
                return '<button type="button" class="afk-dock-blessing ' + (auto ? 'auto' : (active ? 'active' : '')) + '" data-afk-dock-act="pledge-blessing" data-key="' + key + '"><b>' + def.n + '</b><span>' + def.desc + '</span><small>' + (auto ? '自動續期・開' : (active ? '生效中' : '未啟用')) + '</small></button>';
            }).join('');
            body.innerHTML = '<div class="afk-dock-info"><span>' + (cfg ? cfg.honor : faction) + '</span><span>搜索狀 <b>' + countItem('new_item_241') + '</b></span></div><div class="afk-dock-blessings">' + blessings + '</div><div class="afk-dock-grid">' + actionButton('⚔️ 攻城戰', 'pledge-siege', 'danger') + actionButton('🏆 領賞', 'pledge-reward', 'primary') + '</div>';
        }
        function signature() {
            if (!activeType || typeof player === 'undefined' || !player) return activeType;
            if (activeType === 'pandora') { var m = market(); return 'p#' + Number(player.gold || 0) + '#' + (m && Array.isArray(m.slots) ? m.slots.map(function (s) { return s && [s.id,s.price,s.sold?1:0,s.weight].join(':'); }).join('|') : ''); }
            if (activeType === 'castle') { var s = player.siege || {}; return ['c',castleSelectorOpen?1:0,player.bloodPledge,player.lv,countItem('new_item_241'),s.active,s.city,s.victoryCity,s.kills,s.gateKilled,s.towerKilled,s.result,s.rewardPending,Math.ceil((Number(s.endTime || s.cooldownUntil || s.victoryUntil || 0)-Date.now())/1000),player.castleGuard && player.castleGuard.id,player.tracking && player.tracking.until].join('#'); }
            var defs = blessingDefs(); return ['l',player.bloodPledge,countItem('new_item_241')].concat(Object.keys(defs).map(function (k) { return k + ':' + Number(player.blessings && player.blessings[k] || 0) + ':' + (player.blessingAuto && player.blessingAuto[k] ? 1 : 0); })).join('#');
        }
        function render(force) {
            if (!activeType || !dock || typeof player === 'undefined' || !player) return;
            var sig = signature(); if (!force && sig === lastSig) return; lastSig = sig;
            if (activeType === 'castle') renderCastle(); else if (activeType === 'pledge') renderPledge(); else renderPandora();
        }
        function syncState(force) {
            if (!dock) return;
            dock.classList.toggle('hidden', !activeType); dock.dataset.afkDockType = activeType;
            Object.keys(buttons).forEach(function (type) { var on = activeType === type; buttons[type].classList.toggle('active', on); buttons[type].setAttribute('aria-expanded', on ? 'true' : 'false'); });
            if (activeType) {
                AFKRuntime.layers.open('system-shortcuts', { element:dock, position:false, triggers:Object.keys(buttons).map(function (key) { return buttons[key]; }), onClose:function () { saveType(''); dock.classList.add('hidden'); Object.keys(buttons).forEach(function (type) { buttons[type].classList.remove('active'); buttons[type].setAttribute('aria-expanded', 'false'); }); } });
                render(force);
            } else AFKRuntime.layers.close('system-shortcuts', 'toggle');
        }
        function ensure() {
            var panel = document.getElementById('syslog-panel'); if (!panel) return false;
            var header = panel.querySelector('.panel-header'); if (!header) return false;
            var created = false;
            if (!shortcutGroup || !shortcutGroup.isConnected) { shortcutGroup = document.createElement('div'); shortcutGroup.className = 'afk-system-shortcuts'; header.appendChild(shortcutGroup); created = true; }
            [['castle','🏰 城堡'],['pledge','🛡️ 血盟'],['pandora','🔮 黑市']].forEach(function (row) {
                var id = 'afk-' + row[0] + '-toggle', button = document.getElementById(id);
                if (!button) { button = document.createElement('button'); button.id = id; button.type = 'button'; button.textContent = row[1]; button.addEventListener('click', function (e) { e.stopPropagation(); setType(row[0]); }); created = true; }
                if (button.parentNode !== shortcutGroup) shortcutGroup.appendChild(button);
                buttons[row[0]] = button;
            });
            if (!dock || !dock.isConnected) { dock = document.createElement('aside'); dock.id = 'afk-system-dock'; panel.appendChild(dock); lastSig = ''; created = true; }
            if (created) syncState(true);
            return true;
        }
        function hook(name) {
            AFKRuntime.hooks.after(name, 'system-dock', function () { lastSig = ''; render(); });
        }
        function installHooks() {
            ['refreshPandoraMarket','buyPandoraItem','joinPledge','toggleBlessingAuto','startSiege','endSiege','claimSiegeReward','hireCastleGuard','cancelCastleGuard'].forEach(hook);
        }
        document.addEventListener('click', function (e) {
            var action = e.target.closest && e.target.closest('[data-afk-dock-act]'); if (!action || !dock || !dock.contains(action)) return;
            e.preventDefault(); e.stopPropagation(); var act = action.dataset.afkDockAct;
            if (act === 'switch-pledge') { saveType('pledge'); syncState(true); }
            else if (act === 'castle-select-toggle') { castleSelectorOpen = !castleSelectorOpen; lastSig = ''; render(true); return; }
            else if (act === 'castle-start' && typeof startSiege === 'function') startSiege(player.bloodPledge, action.dataset.city || 'kent');
            else if (act === 'castle-travel') { var s = player.siege || {}, cfg = cityConfig(s.city || 'kent'), map = s.gateKilled && cfg ? cfg.inner : (cfg && cfg.outer); if (map && typeof setMapSelectors === 'function') setMapSelectors(map); if (typeof changeMap === 'function') changeMap(true); }
            else if (act === 'castle-reward' || act === 'pledge-reward') { if (typeof claimSiegeReward === 'function') claimSiegeReward(player.bloodPledge); }
            else if (act === 'castle-guard') openCastleGuardShortcut();
            else if (act === 'castle-track') openMonsterTrackingShortcut();
            else if (act === 'pledge-join' && typeof confirmJoinPledge === 'function') confirmJoinPledge(action.classList.contains('tros') ? 'tros' : 'esti');
            else if (act === 'pledge-blessing' && typeof toggleBlessingAuto === 'function') toggleBlessingAuto(action.dataset.key);
            else if (act === 'pledge-siege') { saveType('castle'); castleSelectorOpen = true; syncState(true); return; }
            AFKRuntime.schedule('dock:action', function () { lastSig = ''; render(); });
        });
        window.addEventListener('afk-open-pandora-item', function (e) {
            ensure(); saveType('pandora'); syncState(true);
            var id = e.detail && e.detail.id, card = id && dock.querySelector('[data-afk-pandora-id="' + String(id).replace(/"/g, '') + '"]');
            if (card) { card.classList.add('afk-pandora-highlight'); card.scrollIntoView({ block:'nearest', behavior:'smooth' }); AFKRuntime.schedule('dock:highlight', function () { card.classList.remove('afk-pandora-highlight'); }, { delay:1800, frame:false, replace:true }); }
        });
        var style = document.createElement('style');
        style.textContent = '#afk-system-dock{position:absolute;right:8px;bottom:8px;z-index:18;width:min(430px,calc(100% - 16px));max-height:min(620px,calc(100% - 16px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #7c3aed;border-radius:12px;background:rgba(8,15,30,.97);box-shadow:0 16px 38px rgba(0,0,0,.62);color:#e2e8f0}#afk-system-dock.hidden{display:none!important}.afk-system-dock-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border-bottom:1px solid #334155;background:linear-gradient(135deg,#172554,#312e81)}.afk-system-dock-head b{color:#fde68a;font:900 13px system-ui}.afk-system-dock-head span{color:#cbd5e1;font-size:9px}.afk-system-dock-body{min-height:0;overflow:auto;padding:9px;overscroll-behavior:contain}.afk-dock-status{display:flex;flex-direction:column;gap:3px;margin-bottom:8px;padding:8px;border:1px solid #334155;border-radius:8px;background:#111827}.afk-dock-status strong{color:#67e8f9;font-size:12px}.afk-dock-status span,.afk-dock-status small{color:#94a3b8;font-size:10px}.afk-dock-grid,.afk-dock-castles,.afk-dock-blessings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:7px 0}.afk-dock-castles{grid-template-columns:repeat(3,minmax(0,1fr))}.afk-dock-action,.afk-dock-blessing{min-width:0;padding:8px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#e2e8f0;font:800 10px system-ui;cursor:pointer}.afk-dock-action.primary{border-color:#0369a1;background:#075985}.afk-dock-action.danger{border-color:#b91c1c;background:#7f1d1d}.afk-dock-action.gold{border-color:#a16207;background:#713f12;color:#fef3c7}.afk-dock-action:disabled{cursor:not-allowed;opacity:.45}.afk-dock-blessing{display:flex;flex-direction:column;gap:2px;text-align:left}.afk-dock-blessing b{color:#fde68a}.afk-dock-blessing span,.afk-dock-blessing small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;font-size:8px}.afk-dock-blessing.active{border-color:#059669}.afk-dock-blessing.auto{border-color:#10b981;background:#064e3b}.afk-dock-info,.afk-dock-progress{display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px;padding:6px 8px;border-radius:7px;background:#0f172a;color:#cbd5e1;font-size:10px}.afk-dock-info b,.afk-dock-progress b{color:#fcd34d}.afk-dock-progress .done{color:#6ee7b7}.afk-dock-empty-state{display:flex;flex-direction:column;gap:7px;padding:8px;border:1px dashed #475569;border-radius:9px;color:#94a3b8;font-size:10px}.afk-dock-empty-state b{color:#fcd34d;font-size:12px}.afk-dock-hint{display:block;color:#64748b;font-size:8px;line-height:1.5}#afk-castle-toggle.active,#afk-pledge-toggle.active,#afk-pandora-toggle.active{outline:2px solid #fbbf24;filter:brightness(1.18)}.afk-pandora-highlight{animation:afk-dock-flash .45s ease-in-out 4}@keyframes afk-dock-flash{50%{box-shadow:inset 0 0 0 2px #facc15;background:#713f12}}@media(max-width:760px){#afk-system-dock{right:4px;bottom:4px;width:calc(100% - 8px);max-height:72%}.afk-dock-castles{grid-template-columns:1fr}.afk-dock-grid,.afk-dock-blessings{grid-template-columns:1fr 1fr}}';
        style.textContent += '.afk-system-shortcuts{display:flex;align-items:center;justify-content:flex-end;gap:5px;margin-left:auto;padding:0 4px}.afk-system-shortcuts button{margin:0!important}.afk-castle-services{margin-top:10px;padding-top:9px;border-top:1px solid #334155}.afk-castle-services.empty{color:#64748b}.afk-castle-service-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.afk-castle-service-title b{color:#fde68a;font-size:11px}.afk-castle-service-title small{color:#94a3b8;font-size:8px}.afk-castle-service-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.afk-castle-service{min-width:0;display:grid;grid-template-columns:24px minmax(0,1fr);grid-template-rows:auto auto auto;column-gap:6px;padding:7px;border:1px solid #475569;border-radius:8px;background:linear-gradient(145deg,#1e293b,#111827);color:#e2e8f0;text-align:left;cursor:pointer}.afk-castle-service:hover{border-color:#d4a72c;background:#27364b}.afk-castle-service>span{grid-row:1/4;align-self:center;font-size:19px}.afk-castle-service>b,.afk-castle-service>small,.afk-castle-service>em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.afk-castle-service>b{color:#f8fafc;font-size:10px}.afk-castle-service>small{color:#facc15;font-size:8px}.afk-castle-service>em{color:#94a3b8;font:normal 8px system-ui}@media(min-width:1200px){#afk-system-dock[data-afk-dock-type="castle"]{width:min(610px,calc(100% - 16px))}}@media(max-width:760px){.afk-system-shortcuts{gap:3px}.afk-system-shortcuts button{padding:4px 6px!important;font-size:9px!important}.afk-castle-service-grid{grid-template-columns:1fr}}';
        style.textContent += '.afk-castle-owner{box-sizing:border-box;width:100%;font-family:inherit;text-align:left;cursor:pointer}.afk-castle-owner:hover{border-color:#f59e0b;background:#1c2d26}.afk-castle-owner small{display:block;margin-top:2px;color:#fcd34d!important}.afk-castle-selector,.afk-castle-remote{display:flex;flex-direction:column;gap:6px;margin-top:8px;padding:8px;border:1px solid #334155;border-radius:9px;background:#0f172a}.afk-castle-selector>b,.afk-castle-remote>b{color:#fde68a;font-size:11px}.afk-castle-selector>small{color:#94a3b8;font-size:8px}.afk-castle-selector>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.afk-castle-selector button,.afk-castle-remote button{min-width:0;padding:8px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#e2e8f0;font:800 9px system-ui;cursor:pointer}.afk-castle-selector button:hover:not(:disabled),.afk-castle-remote button:hover:not(:disabled){border-color:#38bdf8;background:#24354c}.afk-castle-selector button:disabled,.afk-castle-remote button:disabled{opacity:.42;cursor:not-allowed}.afk-castle-remote>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.afk-castle-remote button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left}.afk-castle-remote button small{color:#94a3b8;font-size:8px}@media(max-width:760px){.afk-castle-selector>div{grid-template-columns:1fr}.afk-castle-remote>div{grid-template-columns:1fr 1fr}}';
        document.head.appendChild(style);
        function tick() { if (!ensure()) return; installHooks(); render(false); }
        AFKRuntime.when('dock:host', function () { return document.querySelector('#syslog-panel .panel-header'); }, function () { tick(); AFKRuntime.every('dock:refresh', tick, 1000); });
    }

    // ============================================================
    //  🎮 四種遊戲模式切換與模式收藏快照
    // ============================================================
    function initModeSwitcherModule() {
        var MODES = [
            { id:'normal', name:'一般', icon:'🌿', classic:false, traditional:false },
            { id:'classic', name:'經典', icon:'⚔️', classic:true, traditional:false },
            { id:'traditional', name:'傳統', icon:'🏛️', classic:false, traditional:true },
            { id:'classic_traditional', name:'經典＋傳統', icon:'⚔️🏛️', classic:true, traditional:true }
        ];
        var chip = null, overlay = null;
        function modeIdOf(p) { return p && p.classicMode ? (p.traditionalMode ? 'classic_traditional' : 'classic') : (p && p.traditionalMode ? 'traditional' : 'normal'); }
        function modeById(id) { return MODES.filter(function (m) { return m.id === id; })[0] || MODES[0]; }
        function slotNo() { try { return Number(currentSlot) || 1; } catch (e) { return 1; } }
        function profileKey(slot, mode) { return 'afk_mode_profile_' + slot + '_' + mode; }
        function snapshot(slot, mode) {
            if (!player) return;
            var data = { cardDex:player.cardDex || {}, equipDex:player.equipDex || {}, miscDex:player.miscDex || {}, relicDex:player.relicDex || {} };
            try { localStorage.setItem(profileKey(slot, mode), JSON.stringify(data)); } catch (e) {}
        }
        function restore(slot, mode) {
            var data = null; try { data = JSON.parse(localStorage.getItem(profileKey(slot, mode)) || 'null'); } catch (e) {}
            player.cardDex = Object.assign({}, data && data.cardDex || {}); player.cardDexV = 2;
            player.equipDex = Object.assign({}, data && data.equipDex || {}); player.miscDex = Object.assign({}, data && data.miscDex || {}); player.relicDex = Object.assign({}, data && data.relicDex || {});
        }
        function syncChip() {
            if (!chip || typeof player === 'undefined' || !player) return;
            var mode = modeById(modeIdOf(player)), text = mode.icon + ' ' + mode.name, title = '目前模式：' + mode.name + '，點擊切換模式或角色';
            if (chip.textContent !== text) chip.textContent = text; if (chip.dataset.mode !== mode.id) chip.dataset.mode = mode.id; if (chip.title !== title) chip.title = title;
        }
        function close() {
            if (AFKRuntime.layers.close('mode-settings', 'button')) return;
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null;
        }
        function refreshAll() {
            try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
            try { if (typeof applyTheme === 'function') applyTheme(); } catch (e) {}
            try { if (typeof renderSkillSelects === 'function') renderSkillSelects(); } catch (e) {}
            try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
            try { if (typeof renderMobs === 'function') renderMobs(); } catch (e) {}
            try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
            syncChip();
        }
        function mapAllowed(mode) {
            try {
                var entry = typeof mapEntryOf === 'function' ? mapEntryOf(mapState.current) : null;
                if (!entry) return true;
                if (mode.classic && (entry.classicHide || entry.noClassic)) return false;
                if (mode.traditional && (entry.traditionalHide || entry.noTraditional)) return false;
            } catch (e) {}
            return true;
        }
        function applyMode(id) {
            if (!player) return; var next = modeById(id), oldId = modeIdOf(player), slot = slotNo(); if (oldId === next.id) { close(); return; }
            snapshot(slot, oldId); player.classicMode = next.classic; player.traditionalMode = next.traditional; restore(slot, next.id);
            try { if (typeof loadSharedCollections === 'function') loadSharedCollections(); } catch (e) {}
            if (!mapAllowed(next)) {
                try { var home = typeof getHomeTown === 'function' ? getHomeTown() : 'town_silver'; if (typeof setMapSelectors === 'function') setMapSelectors(home); if (typeof changeMap === 'function') changeMap(true); } catch (e) {}
            }
            refreshAll(); try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} close();
        }
        function confirmMode(id) {
            var next = modeById(id), current = modeById(modeIdOf(player)); if (next.id === current.id) return;
            var run = function () { applyMode(next.id); };
            if (typeof gameConfirm === 'function') gameConfirm({ title:'切換遊戲模式', message:'將目前角色從「' + current.name + '」切換為「' + next.name + '」。背包、裝備、技能、任務與協力隊伍會保留，收藏與倉庫改用目標模式資料。', okText:'確認切換', danger:true, onOk:run });
            else if (confirm('確定切換為「' + next.name + '」模式？')) run();
        }
        function loadSlot(slot) {
            try { if (typeof saveGame === 'function') saveGame(); currentSlot = slot; close(); if (typeof loadGame === 'function') loadGame(); setTimeout(syncChip, 0); } catch (e) { console.warn('[AFK] 載入模式角色失敗', e); }
        }
        function renderSlots(host, filter) {
            host.replaceChildren(); var max = typeof SAVE_SLOT_MAX !== 'undefined' ? SAVE_SLOT_MAX : 16, found = 0;
            for (var n = 1; n <= max; n++) {
                if (n === slotNo()) continue;
                var sum = null; try { sum = typeof slotSummary === 'function' ? slotSummary(n) : null; } catch (e) {}
                if (!sum || (filter && modeIdOf({ classicMode:sum.classic, traditionalMode:sum.traditional }) !== filter)) continue;
                found++; (function (slot, s) { var b = document.createElement('button'); b.type = 'button'; b.className = 'afk-mode-slot'; b.textContent = '存檔 ' + slot + '　' + (s.cls || '') + ' Lv.' + (s.lv || 1) + (s.name ? '　' + s.name : ''); b.onclick = function () { loadSlot(slot); }; host.appendChild(b); })(n, sum);
            }
            if (!found) { var empty = document.createElement('p'); empty.className = 'afk-mode-empty'; empty.textContent = '此模式沒有其他已儲存角色。'; host.appendChild(empty); }
        }
        function open() {
            close(); overlay = document.createElement('div'); overlay.id = 'afk-mode-overlay';
            var dialog = document.createElement('section'); dialog.className = 'afk-mode-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
            var head = document.createElement('header'); head.innerHTML = '<div><strong>🎮 遊戲模式</strong><small>切換目前角色，或載入相同模式的其他存檔</small></div><button type="button" aria-label="關閉">×</button>'; head.querySelector('button').onclick = close; dialog.appendChild(head);
            var label = document.createElement('h3'); label.textContent = '目前角色切換模式'; dialog.appendChild(label);
            var modes = document.createElement('div'); modes.className = 'afk-mode-grid'; MODES.forEach(function (m) { var b = document.createElement('button'); b.type = 'button'; b.dataset.mode = m.id; b.className = modeIdOf(player) === m.id ? 'active' : ''; b.textContent = m.icon + ' ' + m.name; b.onclick = function () { confirmMode(m.id); }; modes.appendChild(b); }); dialog.appendChild(modes);
            var slotHead = document.createElement('div'); slotHead.className = 'afk-mode-slot-head'; slotHead.innerHTML = '<h3>載入其他角色</h3>';
            var select = document.createElement('select'); MODES.forEach(function (m) { var o = document.createElement('option'); o.value = m.id; o.textContent = m.icon + ' ' + m.name; select.appendChild(o); }); select.value = modeIdOf(player); slotHead.appendChild(select); dialog.appendChild(slotHead);
            var slots = document.createElement('div'); slots.className = 'afk-mode-slots'; dialog.appendChild(slots); select.onchange = function () { renderSlots(slots, select.value); }; renderSlots(slots, select.value);
            overlay.appendChild(dialog); document.body.appendChild(overlay);
            AFKRuntime.layers.open('mode-settings', { element:overlay, content:dialog, position:false, onClose:function () { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null; } });
        }
        function ensure() {
            if (chip && chip.isConnected) { syncChip(); return; }
            var classic = document.getElementById('classic-badge'), traditional = document.getElementById('traditional-badge'), parent = (traditional || classic) && (traditional || classic).parentElement;
            if (!parent) return;
            chip = document.createElement('button'); chip.id = 'afk-mode-chip'; chip.type = 'button'; chip.onclick = open; parent.appendChild(chip); syncChip();
        }
        function hookLifecycle(name) {
            AFKRuntime.hooks.after(name, 'mode-switcher', function () { ensure(); syncChip(); }); return true;
        }
        function install() { ensure(); hookLifecycle('loadGame'); hookLifecycle('startGame'); }
        AFKRuntime.when('mode:host', function () { return document.getElementById('classic-badge') || document.getElementById('traditional-badge'); }, install);
    }

    // ============================================================
    //  🤝 傭兵能力與成長資料修復
    // ============================================================
    function initAllyIntegrityModule() {
        function normalize(a) {
            if (!a) return;
            a.mhp = Math.max(1, Math.floor(Number(a.mhp) || 1)); a.mmp = Math.max(0, Math.floor(Number(a.mmp) || 0));
            a.curHp = Math.max(0, Math.min(a.mhp, Number(a.curHp) || 0)); a.mp = Math.max(0, Math.min(a.mmp, Number(a.mp) || 0));
            a.exp = Math.max(0, Math.floor(Number(a.exp) || 0)); a._expGained = Math.max(0, Math.floor(Number(a._expGained) || 0));
        }
        function repair() {
            if (typeof player === 'undefined' || !player || !Array.isArray(player.allies)) return;
            player.allies.forEach(function (a) { try { if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(a); } catch (e) {} normalize(a); });
            if (typeof renderSquadPanel === 'function') renderSquadPanel(); if (typeof saveGame === 'function') saveGame();
        }
        function hook() {
            AFKRuntime.hooks.intercept('buildAlly', 'ally-integrity', function (next, self, args) { var ally = next.apply(null, args); normalize(ally); return ally; });
            AFKRuntime.hooks.intercept('_allyLevelRecompute', 'ally-integrity', function (next, self, args) { var result = next.apply(null, args); normalize(args[0]); return result; });
            repair();
        }
        AFKRuntime.when('ally:integrity', function () { return typeof window.buildAlly === 'function' && typeof window._allyLevelRecompute === 'function'; }, hook);
    }

    // ============================================================
    //  🔄 自動復活設定
    // ============================================================
    function initReviveModuleLegacy() {
        var KEY_ON = 'afk_revive_on';
        var KEY_INPLACE = 'afk_revive_inplace';
        var KEY_PRAY = 'afk_revive_pray';
        var on = localStorage.getItem(KEY_ON) !== 'false';
        var useInPlace = localStorage.getItem(KEY_INPLACE) !== 'false';
        var usePray = localStorage.getItem(KEY_PRAY) !== 'false';
        var last = 0, CD = 2500, panel = null, panelOpen = false;

        function upd() {
            var btn = document.getElementById('afk-rv'); if (!btn) return;
            var dot = btn.querySelector('.rv-d'), lbl = btn.querySelector('.rv-l');
            var usable = on && (useInPlace || usePray);
            if (usable) {
                dot.style.background = '#22c55e'; dot.style.boxShadow = '0 0 6px rgba(34,197,94,0.6)';
                lbl.textContent = '自動復活 ' + (useInPlace && usePray ? '原地→祈求' : (useInPlace ? '原地' : '祈求'));
                btn.title = '自動復活已開啟，點擊調整';
            } else {
                dot.style.background = on ? '#f59e0b' : '#ef4444'; dot.style.boxShadow = '0 0 6px rgba(239,68,68,0.4)';
                lbl.textContent = on ? '自動復活未選方式' : '自動復活 OFF';
                btn.title = on ? '尚未選擇復活方式' : '自動復活已關閉，點擊調整';
            }
            if (panel) {
                var master = panel.querySelector('[data-rv="on"]'), inplace = panel.querySelector('[data-rv="inplace"]'), pray = panel.querySelector('[data-rv="pray"]');
                if (master) master.checked = on;
                if (inplace) inplace.checked = useInPlace;
                if (pray) pray.checked = usePray;
                var warning = panel.querySelector('.afk-rv-warning');
                if (warning) warning.style.display = on && !useInPlace && !usePray ? 'block' : 'none';
            }
        }

        function positionPanel() {
            var btn = document.getElementById('afk-rv');
            if (!panel || !btn || !panelOpen) return;
            var r = btn.getBoundingClientRect(), pw = panel.offsetWidth || 260, ph = panel.offsetHeight || 190;
            var left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left));
            var top = r.top - ph - 8;
            if (top < 8) top = Math.min(window.innerHeight - ph - 8, r.bottom + 8);
            panel.style.left = left + 'px'; panel.style.top = Math.max(8, top) + 'px';
        }

        function showPanel(e) {
            if (e) e.stopPropagation();
            panelOpen = !panelOpen;
            if (!panel) return;
            panel.style.display = panelOpen ? 'block' : 'none';
            if (panelOpen) { upd(); requestAnimationFrame(positionPanel); }
        }

        function tryRv() {
            if (!on || (!useInPlace && !usePray) || typeof player === 'undefined' || !player || !player.dead) return;
            var now = Date.now(); if (now - last < CD) return;
            last = now;
            if (useInPlace && typeof reviveInPlace === 'function') {
                try { reviveInPlace(); } catch (e) {}
                if (!player.dead) return;
            }
            if (!usePray || !player.dead) return;
            if (typeof revive === 'function') { try { revive(); } catch (e) {} }
            else {
                var rv = document.getElementById('btn-revive');
                if (rv && !rv.classList.contains('hidden')) { try { rv.click(); } catch (e) {} }
            }
        }

        function createPanel() {
            if (panel) return;
            panel = document.createElement('div');
            panel.id = 'afk-rv-panel';
            panel.style.cssText = 'display:none;position:fixed;z-index:2147483647;width:260px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:rgba(8,12,28,.97);box-shadow:0 16px 40px rgba(0,0,0,.6);color:#e2e8f0;font:12px/1.4 inherit;';
            panel.innerHTML = '<div style="font-weight:800;color:#f8fafc;margin-bottom:9px">🔄 自動復活設定</div>' +
                '<label class="afk-rv-option"><span>自動復活總開關</span><input type="checkbox" data-rv="on"></label>' +
                '<label class="afk-rv-option"><span>優先原地復活</span><input type="checkbox" data-rv="inplace"></label>' +
                '<label class="afk-rv-option"><span>失敗後祈求復活</span><input type="checkbox" data-rv="pray"></label>' +
                '<div class="afk-rv-warning" style="display:none;margin-top:8px;color:#fbbf24">請至少選擇一種復活方式。</div>' +
                '<div style="margin-top:8px;color:#94a3b8;font-size:11px">兩者皆開啟時，會先嘗試返生術／復活卷軸，失敗才回城祈求復活。</div>';
            document.body.appendChild(panel);
            panel.addEventListener('click', function (e) { e.stopPropagation(); });
            panel.addEventListener('change', function (e) {
                var key = e.target && e.target.getAttribute('data-rv'); if (!key) return;
                if (key === 'on') { on = e.target.checked; localStorage.setItem(KEY_ON, String(on)); }
                if (key === 'inplace') { useInPlace = e.target.checked; localStorage.setItem(KEY_INPLACE, String(useInPlace)); }
                if (key === 'pray') { usePray = e.target.checked; localStorage.setItem(KEY_PRAY, String(usePray)); }
                upd();
            });
        }

        function crBtn() {
            if (document.getElementById('afk-rv')) return;
            createPanel();
            var btn = document.createElement('button'); btn.id = 'afk-rv'; btn.type = 'button';
            btn.style.cssText = 'display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(8,12,28,0.85);color:#e2e8f0;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;';
            var dot = document.createElement('span'); dot.className = 'rv-d'; dot.style.cssText = 'width:8px;height:8px;border-radius:50%;display:inline-block;'; btn.appendChild(dot);
            var lbl = document.createElement('span'); lbl.className = 'rv-l'; lbl.style.cssText = 'font-size:11px;'; btn.appendChild(lbl);
            btn.addEventListener('click', showPanel);
            var tgt = document.getElementById('btn-revive-inplace') || document.getElementById('btn-revive');
            if (tgt && tgt.parentNode) { tgt.parentNode.insertBefore(btn, tgt.nextSibling); } else { document.body.appendChild(btn); }
            upd();
        }
        document.addEventListener('click', function () { if (panelOpen && panel) { panelOpen = false; panel.style.display = 'none'; } });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen && panel) { panelOpen = false; panel.style.display = 'none'; } });
        window.addEventListener('resize', positionPanel, { passive: true });
        setTimeout(function () { if (!document.getElementById('btn-revive') && !document.getElementById('btn-revive-inplace')) { setTimeout(arguments.callee, 500); return; } crBtn(); }, 2000);
        setInterval(tryRv, 1200);
    }

    // ============================================================
    //  🛟 自動保命：復活／瞬移／回村共用面板與排程
    // ============================================================
    function initReviveModule() {
        var KEY_MASTER = 'afk_survival_on';
        var KEY_REVIVE = 'afk_revive_on', KEY_INPLACE = 'afk_revive_inplace', KEY_PRAY = 'afk_revive_pray';
        var KEY_TP = 'afk_speed_teleportOn', KEY_TP_HP = 'afk_speed_teleportHp';
        var KEY_TOWN = 'afk_speed_townOn', KEY_TOWN_HP = 'afk_speed_townHp';
        var reviveOn = localStorage.getItem(KEY_REVIVE) !== 'false';
        var useInPlace = localStorage.getItem(KEY_INPLACE) !== 'false';
        var usePray = localStorage.getItem(KEY_PRAY) !== 'false';
        var teleportOn = localStorage.getItem(KEY_TP) === 'true';
        var townOn = localStorage.getItem(KEY_TOWN) !== 'false';
        var teleportHp = Math.max(5, Math.min(95, Number(localStorage.getItem(KEY_TP_HP)) || 20));
        var townHp = Math.max(5, Math.min(95, Number(localStorage.getItem(KEY_TOWN_HP)) || 40));
        var storedMaster = localStorage.getItem(KEY_MASTER);
        var masterOn = storedMaster == null ? (reviveOn || teleportOn || townOn) : storedMaster !== 'false';
        if (storedMaster == null) localStorage.setItem(KEY_MASTER, String(masterOn));
        var panel = null, panelOpen = false, lastAction = 0, CD = 1600;

        function enabledCount() { return (reviveOn && (useInPlace || usePray) ? 1 : 0) + (teleportOn ? 1 : 0) + (townOn ? 1 : 0); }
        function save(key, value) { localStorage.setItem(key, String(value)); }
        function updateButton() {
            var btn = document.getElementById('afk-rv');
            if (!btn) return;
            var dot = btn.querySelector('.rv-d'), lbl = btn.querySelector('.rv-l');
            var count = enabledCount(), usable = masterOn && count > 0;
            if (dot) {
                dot.style.background = usable ? '#22c55e' : (masterOn ? '#f59e0b' : '#ef4444');
                dot.style.boxShadow = usable ? '0 0 6px rgba(34,197,94,.65)' : '0 0 6px rgba(239,68,68,.45)';
            }
            if (lbl) lbl.textContent = masterOn ? ('自動保命 ON · ' + count) : '自動保命 OFF';
            btn.title = '點擊調整自動復活、瞬移與安全回村';
            if (!panel) return;
            var values = {
                master: masterOn, revive: reviveOn, inplace: useInPlace, pray: usePray,
                teleport: teleportOn, town: townOn
            };
            Object.keys(values).forEach(function (key) {
                var input = panel.querySelector('[data-survival="' + key + '"]');
                if (input) input.checked = values[key];
            });
            var tpHp = panel.querySelector('[data-survival="teleportHp"]');
            var townHpEl = panel.querySelector('[data-survival="townHp"]');
            if (tpHp && document.activeElement !== tpHp) tpHp.value = teleportHp;
            if (townHpEl && document.activeElement !== townHpEl) townHpEl.value = townHp;
            panel.classList.toggle('afk-survival-disabled', !masterOn);
            var warning = panel.querySelector('.afk-rv-warning');
            if (warning) warning.style.display = masterOn && !count ? 'block' : 'none';
        }
        function positionPanel() {
            var btn = document.getElementById('afk-rv');
            if (!panel || !btn || !panelOpen) return;
            AFKRuntime.layers.position('survival-settings');
        }
        function togglePanel(e) {
            if (e) e.stopPropagation();
            panelOpen = !panelOpen;
            if (panel) panel.style.display = panelOpen ? 'block' : 'none';
            if (panelOpen) {
                updateButton();
                var btn = document.getElementById('afk-rv');
                AFKRuntime.layers.open('survival-settings', { element:panel, anchor:btn, triggers:[btn], gap:8, onClose:function () { panelOpen = false; if (panel) panel.style.display = 'none'; } });
                AFKRuntime.schedule('survival:position', positionPanel);
            } else AFKRuntime.layers.close('survival-settings', 'toggle');
        }
        function tryRevive() {
            if (!reviveOn || (!useInPlace && !usePray)) return false;
            if (useInPlace && typeof reviveInPlace === 'function') {
                try { reviveInPlace(); } catch (e) {}
                if (!player.dead) return true;
            }
            if (usePray && player.dead) {
                if (typeof revive === 'function') { try { revive(); } catch (e) {} }
                else { var btn = document.getElementById('btn-revive'); if (btn) try { btn.click(); } catch (e) {} }
                return !player.dead;
            }
            return false;
        }
        function canTeleport() {
            var btn = document.getElementById('btn-teleport');
            if (btn && (btn.classList.contains('hidden') || btn.style.display === 'none')) return false;
            try {
                if (player.skills && player.skills.indexOf('sk_teleport') >= 0 && DB.skills && DB.skills.sk_teleport) {
                    var sk = DB.skills.sk_teleport, cost = player.d.getMpCost(sk.mp, sk.tier);
                    if (player.mp >= cost) return true;
                }
                return !!(player.inv && player.inv.some(function (i) { return i.id === 'scroll_teleport' && (i.cnt || 1) > 0; }));
            } catch (e) { return false; }
        }
        function safetyTick() {
            try {
                if (!masterOn || typeof player === 'undefined' || !player) return;
                var now = Date.now(); if (now - lastAction < CD) return;
                if (player.dead) { lastAction = now; tryRevive(); return; }
                if (!player.mhp || (!teleportOn && !townOn)) return;
                if (typeof mapState !== 'undefined' && mapState && String(mapState.current || '').indexOf('town_') === 0) return;
                var hp = player.hp / player.mhp * 100;
                if (teleportOn && hp <= teleportHp && canTeleport()) {
                    lastAction = now;
                    if (typeof playerTeleport === 'function') playerTeleport();
                    else { var tp = document.getElementById('btn-teleport'); if (tp) tp.click(); }
                    return;
                }
                if (townOn && hp <= townHp) {
                    lastAction = now;
                    if (typeof returnToTown === 'function') returnToTown();
                    else { var town = document.getElementById('btn-return-town'); if (town) town.click(); }
                }
            } catch (e) {}
        }
        function createPanel() {
            if (panel) return;
            var oldAuto = document.getElementById('afk-auto-sec');
            if (oldAuto) oldAuto.remove();
            panel = document.createElement('div'); panel.id = 'afk-rv-panel';
            panel.style.cssText = 'display:none;position:fixed;z-index:2147483647;width:300px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:rgba(8,12,28,.97);box-shadow:0 16px 40px rgba(0,0,0,.6);color:#e2e8f0;font:12px/1.4 inherit;';
            panel.innerHTML = '<div class="afk-survival-title">🛟 自動保命設定</div>' +
                '<label class="afk-rv-option afk-survival-master"><span>自動保命總開關</span><input type="checkbox" data-survival="master"></label>' +
                '<section class="afk-survival-section"><b>🔄 自動復活</b><label class="afk-rv-option"><span>啟用自動復活</span><input type="checkbox" data-survival="revive"></label><label class="afk-rv-option"><span>優先原地復活</span><input type="checkbox" data-survival="inplace"></label><label class="afk-rv-option"><span>失敗後祈求復活</span><input type="checkbox" data-survival="pray"></label></section>' +
                '<section class="afk-survival-section"><b>🌀 自動瞬移</b><label class="afk-rv-option"><span>低血量自動瞬移</span><input type="checkbox" data-survival="teleport"></label><label class="afk-survival-number"><span>HP 低於</span><input type="number" min="5" max="95" step="1" data-survival="teleportHp"><em>%</em></label></section>' +
                '<section class="afk-survival-section"><b>🏠 安全回村</b><label class="afk-rv-option"><span>低血量自動回村</span><input type="checkbox" data-survival="town"></label><label class="afk-survival-number"><span>HP 低於</span><input type="number" min="5" max="95" step="1" data-survival="townHp"><em>%</em></label></section>' +
                '<div class="afk-rv-warning" style="display:none">請至少啟用一項保命功能。</div><div class="afk-survival-hint">存活時先嘗試瞬移；無法瞬移才依回村門檻撤離。死亡時先原地復活，失敗才祈求復活。</div>';
            document.body.appendChild(panel);
            panel.addEventListener('click', function (e) { e.stopPropagation(); });
            panel.addEventListener('change', function (e) {
                var key = e.target && e.target.getAttribute('data-survival'); if (!key) return;
                if (key === 'master') { masterOn = e.target.checked; save(KEY_MASTER, masterOn); }
                else if (key === 'revive') { reviveOn = e.target.checked; save(KEY_REVIVE, reviveOn); }
                else if (key === 'inplace') { useInPlace = e.target.checked; save(KEY_INPLACE, useInPlace); }
                else if (key === 'pray') { usePray = e.target.checked; save(KEY_PRAY, usePray); }
                else if (key === 'teleport') { teleportOn = e.target.checked; save(KEY_TP, teleportOn); }
                else if (key === 'town') { townOn = e.target.checked; save(KEY_TOWN, townOn); }
                else if (key === 'teleportHp') { teleportHp = Math.max(5, Math.min(95, Math.floor(Number(e.target.value) || 20))); save(KEY_TP_HP, teleportHp); }
                else if (key === 'townHp') { townHp = Math.max(5, Math.min(95, Math.floor(Number(e.target.value) || 40))); save(KEY_TOWN_HP, townHp); }
                updateButton();
            });
        }
        function createButton() {
            if (document.getElementById('afk-rv')) return;
            createPanel();
            var btn = document.createElement('button'); btn.id = 'afk-rv'; btn.type = 'button';
            btn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(8,12,28,.85);color:#e2e8f0;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;';
            btn.innerHTML = '<span class="rv-d" style="width:8px;height:8px;border-radius:50%;display:inline-block"></span><span class="rv-l" style="font-size:11px"></span>';
            btn.addEventListener('click', togglePanel);
            var anchor = document.getElementById('btn-return-town') || document.getElementById('btn-teleport');
            if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling); else document.body.appendChild(btn);
            updateButton();
        }
        AFKRuntime.when('survival:button', function () { return document.getElementById('btn-return-town'); }, createButton);
        AFKRuntime.every('survival:safety', safetyTick, 700);
    }

    // ============================================================
    //  🎯 福利倍率（注入自動化頁面）
    // ============================================================
    function initWelfareModule() {
        var LS = function (k) { return 'afk_welfare_' + k; };
        var DEF = { exp: 1, mercExp: 1, petExp: 1, gold: 1, drop: 1, qty: 1, dmg: 1, def: 1, hit: 1, aspd: 1, bless: 1, card: 1, hpR: 1, mpR: 1, potion: 1, cast: 1, relic: 1, panacea: 1 };
        var w = {};
        var wen = localStorage.getItem(LS('enabled')) !== 'false';
        var active = {};
        var persistTimers = {};
        var formulaDamageReadyForLog = false;
        var expContext = null;

        function rawCombatSource() {
            try { return typeof _combatSrc !== 'undefined' ? _combatSrc : null; } catch (e) { return null; }
        }
        function combatSource(actor) {
            return AFKRuntime.sources.resolve(actor, rawCombatSource());
        }
        function withCombatSource(source, fn, self, args) {
            try { return AFKRuntime.sources.with(source, args && args[0], fn, self, args); }
            finally { formulaDamageReadyForLog = false; }
        }
        function welfareDamage(value) {
            var src = combatSource();
            if (!src && window.__afkWfDmgAct) src = 'player';
            var result = AFKRuntime.sources.modify('damage', value, { source:src });
            if (result !== value && (src === 'mercenary' || src === 'pet' || src === 'summon')) formulaDamageReadyForLog = true;
            return result;
        }
        function welfareHitOffset() {
            return AFKRuntime.sources.modify('hitOffset', 0, { source:combatSource() });
        }

        function updateActive() {
            active.kill = wen && (w.exp !== 1 || w.mercExp !== 1 || w.petExp !== 1 || w.gold !== 1 || w.drop !== 1 || w.qty !== 1 || w.bless !== 1);
            active.playerCombat = wen && (w.dmg !== 1 || w.hit !== 1);
            active.teamOffense = wen && (w.dmg !== 1 || w.hit !== 1);
            active.regen = wen && (w.hpR !== 1 || w.mpR !== 1);
            active.def = wen && w.def !== 1;
            active.cast = wen && w.cast !== 1;
            active.aspd = wen && w.aspd !== 1;
            active.potion = wen && w.potion !== 1;
            active.card = wen && w.card !== 1;
        }

        function load() {
            if (localStorage.getItem(LS('mercExp')) == null) localStorage.setItem(LS('mercExp'), localStorage.getItem(LS('exp')) || '1');
            if (localStorage.getItem(LS('petExp')) == null) localStorage.setItem(LS('petExp'), localStorage.getItem(LS('exp')) || '1');
            Object.keys(DEF).forEach(function (k) { w[k] = Math.max(0.1, Number(localStorage.getItem(LS(k))) || DEF[k]); });
            updateActive();
        }
        load();

        AFKRuntime.sources.modifier('damage', 'welfare', function (value) {
            if (!wen || w.dmg === 1 || typeof value !== 'number' || !isFinite(value)) return value;
            return Math.max(1, Math.floor(value * w.dmg));
        }, ['player','mercenary','pet','summon']);
        AFKRuntime.sources.modifier('hitOffset', 'welfare', function (value) {
            if (!wen || w.hit === 1) return value;
            return value + Math.max(-19, Math.min(19, Math.round((w.hit - 1) * 10)));
        }, ['player','mercenary','pet','summon']);
        AFKRuntime.sources.modifier('experience', 'welfare', function (value, context) {
            if (!wen) return value;
            var key = context.source === 'pet' ? 'petExp' : (context.source === 'mercenary' ? 'mercExp' : 'exp');
            return value * (w[key] || 1);
        }, ['player','mercenary','pet']);
        AFKRuntime.sources.modifier('attackInterval', 'welfare', function (value) {
            if (!active.aspd || !(value > 0)) return value;
            return Math.max(1, Math.round(value / w.aspd));
        }, ['player','mercenary','pet','summon']);
        AFKRuntime.sources.modifier('recovery', 'welfare', function (value, context) {
            if (!wen || !(value > 0)) return value;
            var multiplier = context.mode === 'potion' ? w.potion : (context.resource === 'mp' ? w.mpR : w.hpR);
            return Math.max(1, Math.floor(value * (multiplier || 1)));
        }, ['player','mercenary','pet','summon']);

        function persistValue(k) {
            if (persistTimers[k]) { clearTimeout(persistTimers[k]); delete persistTimers[k]; }
            localStorage.setItem(LS(k), String(w[k]));
        }

        function sv(k, v, immediate) {
            v = Math.max(0.1, Number(v) || 1);
            w[k] = v;
            updateActive();
            if (immediate) persistValue(k);
            else {
                if (persistTimers[k]) clearTimeout(persistTimers[k]);
                persistTimers[k] = setTimeout(function () { persistValue(k); }, 180);
            }
        }

        // ── Hook killMob：經驗、金錢、掉落率──
        function hookKillMob() {
            if (window.__afkWfKm) return;
            if (typeof window.killMob !== 'function') return;
            var _orig = window.killMob;
            window.killMob = function () {
                if (!active.kill) {
                    window.__afkWf = null;
                    return _orig.apply(this, arguments);
                }
                window.__afkWf = { drop: w.drop, qty: w.qty, exp: w.exp, mercExp: w.mercExp, petExp: w.petExp, gold: w.gold };
                var _preG = w.gold !== 1 && player ? player.gold : 0;
                expContext = (w.exp !== 1 || w.mercExp !== 1 || w.petExp !== 1) ? { playerApplied:false, auditDepth:0 } : null;
                try {
                    var r = _orig.apply(this, arguments);
                    try {
                        if (player && !player.dead) {
                            if (w.gold > 1) { var gg = player.gold - _preG; if (gg > 0) player.gold += Math.floor(gg * (w.gold - 1)); }
                        }
                    } catch (e) {}
                    return r;
                } finally {
                    expContext = null;
                    window.__afkWf = null;
                }
            };
            window.__afkWfKm = true;
        }

        // ── 玩家／傭兵／寵物經驗分流：不再改寫怪物基礎經驗 ──
        function hookExpRouting() {
            var waiting = false;
            if (!window.__afkWfExpMult) {
                if (typeof window.getExpGainMult !== 'function') waiting = true;
                else {
                    var _gainMult = window.getExpGainMult;
                    window.getExpGainMult = function () {
                        var base = _gainMult.apply(this, arguments);
                        if (!expContext || !wen) return base;
                        if (expContext.auditDepth > 0) return AFKRuntime.sources.modify('experience', base, { source:'player' });
                        if (!expContext.playerApplied) { expContext.playerApplied = true; return AFKRuntime.sources.modify('experience', base, { source:'player' }); }
                        return AFKRuntime.sources.modify('experience', base, { source:'mercenary' });
                    };
                    window.getExpGainMult.__afkWfExp = true;
                    window.__afkWfExpMult = true;
                }
            }
            if (!window.__afkWfExpAudit) {
                if (typeof window.auditTrackKill !== 'function') waiting = true;
                else {
                    var _audit = window.auditTrackKill;
                    window.auditTrackKill = function () {
                        if (expContext) expContext.auditDepth++;
                        try { return _audit.apply(this, arguments); }
                        finally { if (expContext) expContext.auditDepth = Math.max(0, expContext.auditDepth - 1); }
                    };
                    window.auditTrackKill.__afkWfExp = true;
                    window.__afkWfExpAudit = true;
                }
            }
            if (!window.__afkWfPetExp) {
                if (typeof window.petsGainExp !== 'function') waiting = true;
                else {
                    var _petsGain = window.petsGainExp;
                    window.petsGainExp = function (amount) {
                        if (!expContext || !wen || w.petExp === 1) return _petsGain.apply(this, arguments);
                        var args = Array.prototype.slice.call(arguments); args[0] = Math.max(0, AFKRuntime.sources.modify('experience', Number(amount || 0), { source:'pet' }));
                        return _petsGain.apply(this, args);
                    };
                    window.petsGainExp.__afkWfExp = true;
                    window.__afkWfPetExp = true;
                }
            }
            if (!waiting && window.__afkWfExpMult && window.__afkWfExpAudit && window.__afkWfPetExp) window.__afkWfExpRouting = true;
        }

        // ── Hook gainItem：統一處理數量倍率 + 掉落率補 roll + 祝福卷軸倍率 ──
        function hookGain() {
            if (window.__afkWfGi) return;
            if (typeof window.gainItem !== 'function') return;
            var _BLESS_IDS = ['new_item_bless_wpn', 'new_item_bless_arm', 'new_item_bless_acc'];
            var _orig = window.gainItem;
            // 為避免 hookBless 再次改寫 gainItem，直接在此統一處理所有邏輯
            window.gainItem = function () {
                var ctx = window.__afkWf;
                if (!ctx || !wen) return _orig.apply(this, arguments);
                var a = Array.prototype.slice.call(arguments);
                var id = a[0];
                var isBless = id && _BLESS_IDS.indexOf(id) >= 0;

                // ① 數量倍率（ctx.qty）
                if (ctx && ctx.qty > 1 && a.length >= 2 && typeof a[1] === 'number') {
                    a[1] = Math.max(1, Math.floor(a[1] * ctx.qty));
                }

                // ② 祝福卷軸倍率：在 killMob 上下文且為祝福卷軸時預先標記
                var _blessRoll = false;
                if (ctx && isBless && wen && w.bless > 1) {
                    if (Math.random() < (w.bless - 1) / w.bless) {
                        _blessRoll = true;
                    }
                }

                var r = _orig.apply(this, a);

                // ③ 祝福卷軸補 roll（在原始呼叫之後，避免改到 ctx）
                if (_blessRoll) {
                    var _saved = window.__afkWf;
                    window.__afkWf = null;
                    _orig.apply(this, a);
                    window.__afkWf = _saved;
                }

                // ④ 掉落率補 roll：若 ctx.drop > 1，有機會多掉一次
                if (ctx && ctx.drop > 1 && a.length >= 2 && typeof a[1] === 'number') {
                    if (Math.random() < (ctx.drop - 1) / ctx.drop) {
                        _orig.apply(this, a);
                    }
                }
                return r;
            };
            window.__afkWfGi = true;
        }

        // ── 各別 retry hook ──
        function hookPlayerDmg() {
            if (window.__afkWfPD) return;
            if (typeof window.getPhysicalDmg !== 'function') return;
            var _gpd = window.getPhysicalDmg;
            window.getPhysicalDmg = function () {
                if (!active.playerCombat || !window.__afkWfDmgAct) return _gpd.apply(this, arguments);
                var t = arguments[1];
                var _savedEr, _hadEr = false;
                if (wen && w.hit !== 1 && t && window.__afkWfDmgAct) {
                    _hadEr = true;
                    _savedEr = t.er;
                    t.er = Math.max(0, Math.floor((t.er || 0) / w.hit));
                }
                try {
                    var r = _gpd.apply(this, arguments);
                    if (wen && w.dmg !== 1 && window.__afkWfDmgAct && r && r.dmg) r.dmg = welfareDamage(r.dmg);
                    return r;
                } finally {
                    if (_hadEr && t) t.er = _savedEr;
                }
            };
            window.__afkWfPD = true;
        }
        function hookPlayerAttackFlag() {
            if (window.__afkWfPA) return;
            if (typeof window.playerAttack !== 'function') return;
            var _pa = window.playerAttack;
            window.playerAttack = function () { window.__afkWfDmgAct = active.playerCombat; try { return _pa.apply(this, arguments); } finally { window.__afkWfDmgAct = false; } };
            window.__afkWfPA = true;
        }
        // ── 隊友命中：所有使用 mobEffAC 的寵物、召喚物與傭兵公式統一加成 ──
        function hookTeamHit() {
            if (window.__afkWfTH) return;
            if (typeof window.mobEffAC !== 'function') return;
            var _mea = window.mobEffAC;
            window.mobEffAC = function () {
                var r = _mea.apply(this, arguments), src = combatSource(arguments[1]);
                if (!active.teamOffense || (src !== 'pet' && src !== 'summon' && src !== 'mercenary')) return r;
                return r + welfareHitOffset();
            };
            window.__afkWfTH = true;
        }

        // ── 明確標記傭兵／召喚物來源，巢狀召喚會覆蓋外層傭兵來源 ──
        function hookCombatSources() {
            if (!window.__afkWfSourceAllies && typeof window.alliesTick === 'function') {
                AFKRuntime.hooks.intercept('alliesTick', 'welfare-source', function (next, self, args) {
                    if (!active.teamOffense) return next.apply(null, args);
                    return withCombatSource('mercenary', function () { return next.apply(null, args); }, self, []);
                });
                window.__afkWfSourceAllies = true;
            }
            if (!window.__afkWfSourceSummon && typeof window.summonTick === 'function') {
                AFKRuntime.hooks.intercept('summonTick', 'welfare-source', function (next, self, args) {
                    if (!active.teamOffense) return next.apply(null, args);
                    return withCombatSource('summon', function () { return next.apply(null, args); }, self, []);
                });
                window.__afkWfSourceSummon = true;
            }
        }

        // ── 寵物與傭兵公式皆在 royalAllyMult 的最終乘算點落地 ──
        function hookCompanionDamage() {
            if (window.__afkWfCD) return;
            if (typeof window.royalAllyMult !== 'function') return;
            if (!window.__afkWfAllyRecomputeGuard && typeof window._allyLevelRecompute === 'function') {
                AFKRuntime.hooks.intercept('_allyLevelRecompute', 'welfare-stat-guard', function (next, self, args) {
                    window.__afkWfStatRecompute = true;
                    try { return next.apply(null, args); }
                    finally { window.__afkWfStatRecompute = false; }
                });
                window.__afkWfAllyRecomputeGuard = true;
            }
            var _ram = window.royalAllyMult;
            window.royalAllyMult = function () {
                var r = _ram.apply(this, arguments), src = combatSource();
                if (window.__afkWfStatRecompute || !active.teamOffense || w.dmg === 1 || (src !== 'pet' && src !== 'mercenary' && src !== 'summon')) return r;
                formulaDamageReadyForLog = true;
                return r * w.dmg;
            };
            window.__afkWfCD = true;
        }

        // 部分傭兵特效先寫戰鬥文字、再交給 _allyDamageMob 做最終乘算；只校正這種尚未乘算的文字。
        function hookCombatDamageLog() {
            if (!window.__afkWfDamageLog && typeof window.logCombat === 'function') {
                var _logCombat = window.logCombat;
                window.logCombat = function () {
                    if (!active.teamOffense || w.dmg === 1) return _logCombat.apply(this, arguments);
                    var src = combatSource();
                    if (src !== 'mercenary' && src !== 'pet' && src !== 'summon') return _logCombat.apply(this, arguments);
                    var a = Array.prototype.slice.call(arguments);
                    if (formulaDamageReadyForLog) formulaDamageReadyForLog = false;
                    else if (typeof a[0] === 'string' && a[0].indexOf('造成') >= 0) {
                        a[0] = a[0].replace(/(造成(?:\s|<[^>]*>)*)((?:\d{1,3}(?:,\d{3})+|\d+))/, function (_, prefix, number) {
                            var raw = Number(String(number).replace(/,/g, ''));
                            return prefix + String(welfareDamage(raw));
                        });
                        formulaDamageReadyForLog = false;
                    }
                    return _logCombat.apply(this, a);
                };
                window.__afkWfDamageLog = true;
            }
            if (!window.__afkWfAllyDamageBoundary && typeof window._allyDamageMob === 'function') {
                var _allyDamageMob = window._allyDamageMob;
                window._allyDamageMob = function () {
                    try { return _allyDamageMob.apply(this, arguments); }
                    finally { formulaDamageReadyForLog = false; }
                };
                window.__afkWfAllyDamageBoundary = true;
            }
        }

        // ── 遠距召喚、觸發技與立方共用的元素傷害落點 ──
        function hookSummonElementDamage() {
            if (window.__afkWfSED) return;
            if (typeof window.summonElementDamage !== 'function') return;
            var _sed = window.summonElementDamage;
            window.summonElementDamage = function () {
                var r = _sed.apply(this, arguments);
                if (!active.teamOffense || w.dmg === 1 || combatSource() !== 'summon') return r;
                return welfareDamage(r);
            };
            window.__afkWfSED = true;
        }

        // ── 標準召喚：近戰／迷魅為直接公式，遠距與 proc 交給 summonElementDamage ──
        function hookSummonAttackDamage() {
            if (window.__afkWfSummonAttack || typeof window.summonAttack !== 'function') return;
            var _summonAttack = window.summonAttack;
            window.summonAttack = function (sm, owner) {
                if (!active.teamOffense) return _summonAttack.apply(this, arguments);
                owner = owner || player;
                return withCombatSource('summon', function () {
                    if (!sm) return;
                    var t = getTarget(); if (!t) return;
                    var cha = (owner.d && owner.d.cha) || 0;
                    var sgb = typeof summonGearBonus === 'function' ? summonGearBonus(owner) : { dmg: 0, hit: 0 };
                    var idx = mapState.mobs.findIndex(function (m) { return m && m.uid === t.uid; });
                    if (sm.skId === 'sk_charm') {
                        var charmHv = Math.max(1, Math.min(20, owner.lv + sm.hitBonus + cha - t.lv + mobEffAC(t) + sgb.hit + (hasSummonCtrlRing(owner) ? 5 : 0)));
                        var charmRoll = roll(1, 20);
                        if (!((charmRoll === 20) || (charmRoll !== 1 && charmHv >= charmRoll) || (charmRoll === 19 && hasSummonCtrlRing(owner)))) { logCombat(sm.n + ' 的攻擊未命中。', 'miss'); return; }
                        var charmDmg = welfareDamage(Math.max(1, roll(sm.dmgDice[0], sm.dmgDice[1]) + cha + sgb.dmg - (t.dr || 0)));
                        t.justHit = 'normal'; t.curHp -= charmDmg; mobWake(t);
                        logCombat('<span class="text-purple-300">' + sm.n + '</span> 攻擊 <span class="' + getMobColor(t.lv) + '">' + t.n + '</span>，造成 ' + charmDmg + ' 點傷害。', 'player');
                        if (t.curHp <= 0 && idx !== -1) killMob(idx); else renderMobs();
                        return;
                    }
                    var chaCnt = Math.min(60, cha);
                    var hits = sm.kind === 'melee' ? Math.max(1, Math.floor(chaCnt / 6)) : ((owner.mastery === 'e_spirit' && (sm.skId === 'sk_elf_summon' || sm.skId === 'sk_elf_summon2')) ? Math.min(7, 1 + Math.floor(chaCnt / 10)) : 1);
                    var hitLvOff = sm.hitLvOff || 0;
                    var chaEff = owner.mastery === 'm_summon' && (sm.skId === 'sk_zombie' || sm.skId === 'sk_summon') ? cha * 1.2 : cha;
                    for (var i = 0; i < hits; i++) {
                        if (t.curHp <= 0) break;
                        var hv = Math.max(1, Math.min(20, owner.lv + hitLvOff + chaEff - t.lv + mobEffAC(t) + sgb.hit + (hasSummonCtrlRing(owner) ? 5 : 0)));
                        var hitRoll = roll(1, 20);
                        if (!((hitRoll === 20) || (hitRoll !== 1 && hv >= hitRoll) || (hitRoll === 19 && hasSummonCtrlRing(owner)))) { logCombat(sm.n + ' 的攻擊未命中。', 'miss'); continue; }
                        var dmg;
                        if (sm.kind === 'ranged') {
                            var flat = Math.floor(cha * owner.lv / (sm.elemScale || 20));
                            dmg = summonElementDamage(sm.dmgDice, sm.ele, t, flat + sgb.dmg);
                            t.justHit = sm.ele !== 'none' ? sm.ele : 'magic';
                        } else {
                            var flatBase = chaEff / (sm.dmgDiv || 5);
                            var meleeFlat = sm.dmgLvDiv ? Math.floor(flatBase * (1 + owner.lv / sm.dmgLvDiv)) : Math.floor(flatBase);
                            dmg = welfareDamage(Math.max(1, roll(sm.dmgDice[0], sm.dmgDice[1]) + meleeFlat + sgb.dmg - (t.dr || 0) - mobHardSkin(t)));
                            t.justHit = 'normal';
                        }
                        t.curHp -= dmg; mobWake(t);
                        logCombat('<span class="text-purple-300">' + sm.n + '</span> 攻擊 <span class="' + getMobColor(t.lv) + '">' + t.n + '</span>，造成 ' + dmg + ' 點傷害。', 'player');
                    }
                    if (t.curHp <= 0 && idx !== -1) killMob(idx); else renderMobs();
                }, this, []);
            };
            window.summonAttack.__afkWfSummonAttack = true;
            window.__afkWfSummonAttack = true;
        }

        // ── 幻象直接傷害：在扣血、文字與擊殺判定前完成乘算 ──
        function hookIllusionSummonDamage() {
            if (window.__afkWfIllusion || typeof window.illuSummonTick !== 'function') return;
            var _illuSummonTick = window.illuSummonTick;
            window.illuSummonTick = function (owner) {
                if (!active.teamOffense) return _illuSummonTick.apply(this, arguments);
                owner = owner || player;
                return withCombatSource('summon', function () {
                    if ((owner === player ? player.dead : owner._downed) || !state.running || owner.mastery !== 'i_illusion') return;
                    var map = {
                        sk_illu_ogre: { iv: 20, dice: [3, 20], div: 10, kind: 'melee', hitOff: 10, n: '歐吉' },
                        sk_illu_lich: { iv: 30, dice: [3, 20], div: 10, kind: 'magic', n: '巫妖' },
                        sk_illu_golem: { iv: 10, dice: [2, 20], div: 5, kind: 'melee', hitOff: 20, n: '鑽石高崙', iceLance: true }
                    };
                    owner._illuCd = owner._illuCd || {};
                    var d = owner.d || {};
                    Object.keys(map).forEach(function (sid) {
                        var enabled = owner === player ? ((owner.buffs[sid] || 0) > 0) : !!(owner.skills && owner.skills.indexOf(sid) >= 0);
                        if (!enabled) { owner._illuCd[sid] = 0; return; }
                        var c = map[sid];
                        if ((owner._illuCd[sid] = (owner._illuCd[sid] || c.iv) - 1) > 0) return;
                        owner._illuCd[sid] = c.iv;
                        var t = getTarget(); if (!t || t.curHp <= 0) return;
                        var base = roll(c.dice[0], c.dice[1]) + Math.floor((d.int || 0) / 5) * (1 + owner.lv / c.div);
                        var dmg;
                        if (c.kind === 'magic') {
                            var effMr = (t.st && t.st.mrhalf > 0) ? t.mr / 2 : t.mr;
                            if (t.st && (t.st.confuse > 0 || t.st.panic > 0)) effMr -= 10;
                            dmg = Math.max(1, Math.floor(base * mrMult(Math.max(0, effMr))));
                        } else {
                            var hv = Math.max(1, Math.min(20, owner.lv + c.hitOff - t.lv + (d.int || 0) + mobEffAC(t)));
                            var hitRoll = roll(1, 20);
                            if (!(hitRoll === 20 || (hitRoll !== 1 && hv >= hitRoll))) { logCombat('<span class="text-purple-300 font-bold">【幻覺：' + c.n + '】</span> 的攻擊未命中。', 'miss', 'summon'); return; }
                            dmg = Math.max(1, Math.floor(base) - (t.dr || 0));
                        }
                        dmg = welfareDamage(Math.max(1, Math.floor(dmg * fragileMult(t) * illuLvMult(owner))));
                        t.curHp -= dmg; t.justHit = c.kind === 'magic' ? 'magic' : 'none'; mobWake(t);
                        logCombat('<span class="text-purple-300 font-bold">【幻覺：' + c.n + '】</span>對 <span class="' + getMobColor(t.lv) + '">' + t.n + '</span> 造成 ' + dmg + ' 點傷害。', 'magic', 'summon');
                        var idx = mapState.mobs.findIndex(function (m) { return m && m.uid === t.uid; });
                        if (t.curHp <= 0) { if (idx !== -1) killMob(idx); return; }
                        if (c.iceLance && Math.random() < 0.10) { if (owner === player && typeof witchIceLance === 'function') witchIceLance(); else if (owner !== player && typeof allyWitchIceLance === 'function') allyWitchIceLance(owner); }
                        renderMobs();
                    });
                }, this, []);
            };
            window.illuSummonTick.__afkWfIllusion = true;
            window.__afkWfIllusion = true;
        }

        function hookDmgHit() {
            hookPlayerDmg();
            hookPlayerAttackFlag();
            hookCombatSources();
            hookTeamHit();
            hookCompanionDamage();
            hookCombatDamageLog();
            hookSummonElementDamage();
            hookSummonAttackDamage();
            hookIllusionSummonDamage();
        }
        // ── HP/MP 恢復倍率 hook ──
        function hookRegen() {
            if (window.__afkWfRg) return;
            if (typeof window.regenTick !== 'function') return;
            var _rt = window.regenTick;
            window.regenTick = function () {
                if (!active.regen) return _rt.apply(this, arguments);
                var _preHP = player ? player.hp : 0;
                var _preMP = player ? player.mp : 0;
                var r = _rt.apply(this, arguments);
                try {
                    if (player && !player.dead) {
                        var _hG = player.hp - _preHP, _mG = player.mp - _preMP;
                        if (_hG > 0) player.hp = Math.min(player.mhp, _preHP + AFKRuntime.sources.modify('recovery', _hG, { source:'player', actor:player, resource:'hp', mode:'passive' }));
                        if (_mG > 0) player.mp = Math.min(player.mmp, _preMP + AFKRuntime.sources.modify('recovery', _mG, { source:'player', actor:player, resource:'mp', mode:'passive' }));
                    }
                } catch (e) {}
                return r;
            };
            window.__afkWfRg = true;
            hookAllyRegen();
        }

        function hookAllyRegen() {
            if (window.__afkWfAR) return;
            if (typeof window.alliesTick !== 'function') return;
            AFKRuntime.hooks.intercept('alliesTick', 'welfare-recovery', function (next, self, args) {
                if (!active.regen || typeof player === 'undefined' || !player || !player.allies || !player.allies.length) return next.apply(null, args);
                var snap = player.allies.map(function (a) { return a ? { a: a, hp: Number(a.curHp) || 0, mp: Number(a.mp) || 0 } : null; });
                var r = next.apply(null, args);
                snap.forEach(function (s) {
                    if (!s || !s.a || s.a._downed) return;
                    var hpGain = (Number(s.a.curHp) || 0) - s.hp;
                    var mpGain = (Number(s.a.mp) || 0) - s.mp;
                    if (hpGain > 0) s.a.curHp = Math.min(Number(s.a.mhp) || 1, s.hp + AFKRuntime.sources.modify('recovery', hpGain, { source:'mercenary', actor:s.a, resource:'hp', mode:'passive' }));
                    if (mpGain > 0) s.a.mp = Math.min(Number(s.a.mmp) || 0, s.mp + AFKRuntime.sources.modify('recovery', mpGain, { source:'mercenary', actor:s.a, resource:'mp', mode:'passive' }));
                });
                return r;
            });
            window.__afkWfAR = true;
        }
        // ── 藥水恢復倍率：玩家、傭兵與寵物只調整實際藥水回血 ──
        function hookPotionRecovery() {
            var waiting = false;
            function installOne(name, actorAt, hpKey, maxKey, eligible) {
                var fn = window[name];
                if (typeof fn !== 'function') { waiting = true; return; }
                if (fn.__afkWfPotion) return;
                var wrapped = function () {
                    if (!active.potion || (eligible && !eligible(arguments))) return fn.apply(this, arguments);
                    var actor = actorAt < 0 ? (typeof player !== 'undefined' ? player : null) : arguments[actorAt];
                    if (!actor) return fn.apply(this, arguments);
                    var before = Number(actor[hpKey] || 0), result = fn.apply(this, arguments), after = Number(actor[hpKey] || 0), gain = after - before;
                    if (gain > 0) {
                        var source = actorAt < 0 ? 'player' : (name === 'allyTryPotion' ? 'mercenary' : 'pet');
                        var adjusted = AFKRuntime.sources.modify('recovery', gain, { source:source, actor:actor, resource:'hp', mode:'potion' });
                        actor[hpKey] = Math.min(Number(actor[maxKey] || before + adjusted), before + adjusted);
                        try { if (actor === player && typeof updateUI === 'function') updateUI(); else if (typeof renderSquadPanel === 'function') renderSquadPanel(); } catch (e) {}
                    }
                    return result;
                };
                wrapped.__afkWfPotion = true; wrapped.__afkWfPotionOriginal = fn; window[name] = wrapped;
            }
            installOne('useItem', -1, 'hp', 'mhp', function (args) {
                try {
                    var stack = player && player.inv && player.inv.find(function (item) { return item && String(item.uid) === String(args[0]); });
                    var id = stack && stack.id;
                    return !!(id && (id.indexOf('potion_heal') >= 0 || id === 'potion_strong' || id === 'potion_ult'));
                } catch (e) { return false; }
            });
            installOne('allyTryPotion', 0, 'curHp', 'mhp');
            installOne('petTryPotion', 0, 'hp', 'mhp');
            if (!waiting) window.__afkWfPotion = true;
        }

        function welfareAttackInterval(base, source, actor) {
            return AFKRuntime.sources.modify('attackInterval', base, { source:source || combatSource(actor), actor:actor });
        }

        // ── 友方普通攻擊速度：各來源只調整自己的排程間隔 ──
        function hookAttackIntervals() {
            var waiting = false;
            function wrapResult(name, field) {
                var fn = window[name];
                if (typeof fn !== 'function') { waiting = true; return; }
                if (fn.__afkWfAspd) return;
                var wrapped = function () {
                    var result = fn.apply(this, arguments);
                    if (!active.aspd || !result || !(Number(result[field]) > 0)) return result;
                    var copy = Object.assign({}, result), source = name === 'petDerive' ? 'pet' : 'summon'; copy[field] = welfareAttackInterval(Number(result[field]), source, arguments[0]); return copy;
                };
                wrapped.__afkWfAspd = true; wrapped.__afkWfAspdOriginal = fn; window[name] = wrapped;
            }
            if (typeof window.allyAttackIntervalTicks !== 'function') waiting = true;
            else if (!window.allyAttackIntervalTicks.__afkWfAspd) {
                var _allyInterval = window.allyAttackIntervalTicks;
                var allyWrapped = function (ally) {
                    var base = _allyInterval.apply(this, arguments);
                    if (!active.aspd) return base;
                    var skillReady = !!(ally && ally._atkSkill && Number(ally._atkSkillCd || 0) <= 0);
                    return skillReady ? base : welfareAttackInterval(base, 'mercenary', ally);
                };
                allyWrapped.__afkWfAspd = true; allyWrapped.__afkWfAspdOriginal = _allyInterval; window.allyAttackIntervalTicks = allyWrapped;
            }
            wrapResult('petDerive', 'atkItv');
            wrapResult('_sumDeriveAny', 'aspd');
            if (typeof window.summonTick !== 'function') waiting = true;
            else if (!window.__afkWfSummonAspd) {
                AFKRuntime.hooks.intercept('summonTick', 'welfare-attack-speed', function (next, self, args) {
                    var sm = args[0];
                    if (!active.aspd || !sm || !(Number(sm.interval) > 0)) return next.apply(null, args);
                    var base = Number(sm.interval), effective = welfareAttackInterval(base, 'summon', sm); sm.interval = effective;
                    if (Number(sm.cd || 0) > effective) sm.cd = effective;
                    try { return next.apply(null, args); }
                    finally { sm.interval = base; }
                });
                window.__afkWfSummonAspd = true;
            }
            if (!waiting) window.__afkWfAspd = true;
        }

        // ── 施法速度與玩家普通攻擊速度倍率 hook ──
        function hookCastSpd() {
            if (window.__afkWfCs) return;
            if (typeof window.tick !== 'function') return;
            var _tick = window.tick, castCredit = 0;
            window.tick = function () {
                if (active.cast && w.cast > 1 && typeof player !== 'undefined' && player) {
                    castCredit += w.cast - 1;
                    var extra = Math.floor(castCredit);
                    castCredit -= extra;
                    if (extra > 0) {
                        if (player.cds && player.cds.atkSk > 0) player.cds.atkSk = Math.max(0, player.cds.atkSk - extra);
                        (player.allies || []).forEach(function (ally) {
                            if (!ally || ally._downed) return;
                            if (ally._atkSkillCd > 0) ally._atkSkillCd = Math.max(0, ally._atkSkillCd - extra);
                            if (ally.cls === 'mage' || ally._atkSkill || ally._healSkill) ally._atkCd = (ally._atkCd || 0) - extra;
                        });
                    }
                }
                var savedAspd = null, savedActor = null;
                if (active.aspd && typeof player !== 'undefined' && player && player.d && Number(player.d.aspd) > 0) {
                    savedActor = player; savedAspd = savedActor.d.aspd; savedActor.d.aspd = Math.max(0.1, Number(savedAspd) / w.aspd);
                }
                try { return _tick.apply(this, arguments); }
                finally { if (savedAspd != null && savedActor && savedActor.d) savedActor.d.aspd = savedAspd; }
            };
            window.__afkWfCs = true;
        }

        // ── 傭兵物理、魔法與持續傷害減免 ──
        function hookAllyDef() {
            if (window.__afkWfAl) return;
            var names = [
                { n: 'enemyAttackAlly', i: 1 },
                { n: 'applyMobMagicToAlly', i: 2 },
                { n: 'processAllyStatusTick', i: 0 }
            ];
            var waiting = false;
            names.forEach(function (cfg) {
                if (typeof window[cfg.n] !== 'function' || window[cfg.n].__afkAllyDef) { if (typeof window[cfg.n] !== 'function') waiting = true; return; }
                var _orig = window[cfg.n];
                var wrapped = function () {
                    var ally = arguments[cfg.i];
                    if (!active.def || !ally || ally._downed) return _orig.apply(this, arguments);
                    var beforeHp = Number(ally.curHp) || 0, beforeDowned = !!ally._downed, beforeCd = ally._reviveCd || 0;
                    var r = _orig.apply(this, arguments);
                    var lost = beforeHp - (Number(ally.curHp) || 0);
                    if (lost <= 0 || w.def <= 1) return r;
                    var adjusted = Math.max(0, beforeHp - Math.max(1, Math.ceil(lost / w.def)));
                    ally.curHp = Math.min(Number(ally.mhp) || beforeHp, adjusted);
                    if (!beforeDowned && adjusted > 0 && ally._downed) {
                        ally._downed = false;
                        ally._reviveCd = beforeCd;
                        if (cfg.n === 'processAllyStatusTick') r = false;
                    }
                    return r;
                };
                wrapped.__afkAllyDef = true;
                window[cfg.n] = wrapped;
            });
            if (waiting) return;
            window.__afkWfAl = true;
        }

        // ── Hook enemyPhysicalAttack / enemyMagicAttack：減傷倍率 ──
        function hookDef() {
            if (window.__afkWfDe) return;
            function makeHook(fnName) {
                if (typeof window[fnName] !== 'function') return false;
                var _orig = window[fnName];
                window[fnName] = function () {
                    if (!active.def) return _orig.apply(this, arguments);
                    var _pre = player ? player.hp : 0;
                    var r = _orig.apply(this, arguments);
                    try {
                        if (player && !player.dead) {
                            var _took = _pre - player.hp;
                            if (_took > 0) {
                                var _bak = Math.floor(_took - (_took / w.def));
                                if (_bak > 0) { player.hp = Math.min(player.mhp, player.hp + _bak); updateUI(); }
                            }
                        }
                    } catch (e) {}
                    return r;
                };
                return true;
            }
            makeHook('enemyPhysicalAttack');
            makeHook('enemyMagicAttack');
            hookAllyDef();
            window.__afkWfDe = true;
        }

        // ── Hook rollCardDrops：卡片掉落率倍率 ──
        function hookCard() {
            if (window.__afkWfCa) return;
            if (typeof window.rollCardDrops !== 'function') return;
            var _orig = window.rollCardDrops;
            window.rollCardDrops = function () {
                if (!active.card) return _orig.apply(this, arguments);
                var r = _orig.apply(this, arguments);
                // 若卡片倍率 > 1，額外補 roll
                if (wen && w.card > 1) {
                    var mob = arguments[0];
                    if (mob && mob.n) {
                        // 用 (card-1)/card 機率再 roll 一次
                        if (Math.random() < (w.card - 1) / w.card) {
                            _orig.apply(this, arguments);
                        }
                    }
                }
                return r;
            };
            window.__afkWfCa = true;
        }

        // ── UI 注入（自動化頁面）──
        function injUI() {
            var panel = document.getElementById('tab-automation');
            if (!panel) return;
            if (document.getElementById('afk-welfare-sec')) return;

            var rows = [
                { k: 'exp', i: '📈', l: '玩家經驗倍率', mn: 0.1, mx: 100, st: 0.1 },
                { k: 'mercExp', i: '🤝', l: '傭兵經驗倍率', mn: 0.1, mx: 100, st: 0.1 },
                { k: 'petExp', i: '🐾', l: '寵物經驗倍率', mn: 0.1, mx: 100, st: 0.1 },
                { k: 'gold', i: '💰', l: '金錢倍率', mn: 0.1, mx: 100, st: 0.1 },
                { k: 'drop', i: '🎁', l: '掉落率倍率', mn: 0.1, mx: 50, st: 0.1 },
                { k: 'qty', i: '📦', l: '數量倍率', mn: 0.1, mx: 10, st: 0.1 },
                { k: 'dmg', i: '⚔️', l: '傷害倍率', mn: 0.1, mx: 100, st: 0.1 },
                { k: 'def', i: '🛡️', l: '減傷倍率', mn: 0.1, mx: 10, st: 0.1 },
                { k: 'hit', i: '🎯', l: '命中率倍率', mn: 0.1, mx: 10, st: 0.1 },
                { k: 'aspd', i: '🏹', l: '友方攻擊速度倍率', mn: 0.1, mx: 10, st: 0.1 },
                { k: 'bless', i: '📜', l: '祝福卷軸倍率', mn: 0.1, mx: 50, st: 0.1 },
                { k: 'card', i: '🎴', l: '卡片掉落倍率', mn: 0.1, mx: 50, st: 0.1 },
                { k: 'hpR', i: '❤️', l: 'HP恢復倍率', mn: 0.1, mx: 10, st: 0.1 },
                { k: 'mpR', i: '💙', l: 'MP恢復倍率', mn: 0.1, mx: 10, st: 0.1 },
                { k: 'potion', i: '🍶', l: '藥水恢復倍率', mn: 0.1, mx: 10, st: 0.1 },
                { k: 'cast', i: '⚡', l: '施法速度倍率', mn: 0.1, mx: 10, st: 0.1 },
                { k: 'relic', i: '🏺', l: '遺物掉落率倍率', mn: 0.1, mx: 50, st: 0.1 },
                { k: 'panacea', i: '💎', l: '萬能藥掉落率倍率', mn: 0.1, mx: 50, st: 0.1 },
            ];
            var rowMap = {};
            rows.forEach(function (r) { rowMap[r.k] = r; });
            var groups = [
                { k: 'gain', i: '📊', l: '收益', keys: ['exp', 'mercExp', 'petExp', 'gold', 'qty'], open: true },
                { k: 'combat', i: '⚔️', l: '戰鬥', keys: ['dmg', 'hit', 'def', 'aspd', 'cast'], open: false },
                { k: 'drop', i: '🎁', l: '掉落', keys: ['drop', 'card', 'bless', 'relic', 'panacea'], open: false },
                { k: 'recovery', i: '💚', l: '恢復', keys: ['hpR', 'mpR', 'potion'], open: false },
            ];

            function formatValue(v) { return v >= 10 ? String(Math.round(v)) : Number(v).toFixed(1); }
            function rowHtml(r) {
                var v = w[r.k] || 1;
                var fs = formatValue(v);
                return '<div class="afk-wf-row" data-wrow="' + r.k + '">' +
                    '<span class="afk-wf-label">' + r.i + ' ' + r.l + '</span>' +
                    '<input type="range" min="' + r.mn + '" max="' + r.mx + '" step="' + r.st + '" value="' + v + '" data-wk="' + r.k + '">' +
                    '<input type="number" min="' + r.mn + '" max="' + r.mx + '" step="' + r.st + '" value="' + fs + '" data-wk="' + r.k + '">' +
                    '<span class="afk-wf-value">' + (v !== 1 ? fs + '×' : '1×') + '</span></div>';
            }
            function groupHtml(g) {
                var saved = localStorage.getItem(LS('group_' + g.k));
                var open = saved == null ? g.open : saved === 'true';
                var count = g.keys.filter(function (k) { return w[k] !== 1; }).length;
                return '<section class="afk-wf-group" data-wgroup="' + g.k + '">' +
                    '<button type="button" class="afk-wf-group-head" data-wg="' + g.k + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
                    '<span>' + g.i + ' ' + g.l + '</span><span class="afk-wf-group-meta"><span data-wcount>' + (count ? count + ' 項已調整' : '預設') + '</span><span data-warrow>' + (open ? '▾' : '▸') + '</span></span></button>' +
                    '<div class="afk-wf-group-body"' + (open ? '' : ' hidden') + '>' + g.keys.map(function (k) { return rowHtml(rowMap[k]); }).join('') + '</div></section>';
            }

            var sec = document.createElement('div'); sec.id = 'afk-welfare-sec'; sec.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
            sec.innerHTML = '<div class="text-sm text-emerald-400 mb-2 border-b border-slate-700 pb-1 font-bold flex items-center justify-between">' +
                '<span>🎯 福利倍率</span>' +
                '<label class="flex items-center gap-1.5 text-slate-400 text-xs font-normal"><input type="checkbox" id="afk-wf-en" class="w-3.5 h-3.5 accent-emerald-500" ' + (wen ? 'checked' : '') + '><span>啟用</span></label></div>' +
                '<div class="afk-wf-groups">' + groups.map(groupHtml).join('') + '</div>';

            var fs = panel.querySelector('.bg-slate-800');
            if (fs) { fs.parentNode.insertBefore(sec, fs.nextSibling); } else { panel.appendChild(sec); }

            function updateCounts() {
                groups.forEach(function (g) {
                    var count = g.keys.filter(function (k) { return w[k] !== 1; }).length;
                    var host = sec.querySelector('[data-wgroup="' + g.k + '"] [data-wcount]');
                    if (host) host.textContent = count ? count + ' 項已調整' : '預設';
                });
            }
            function syncRow(k, source) {
                var row = sec.querySelector('[data-wrow="' + k + '"]');
                if (!row) return;
                var v = w[k], fs = formatValue(v);
                var range = row.querySelector('input[type="range"]');
                var number = row.querySelector('input[type="number"]');
                var label = row.querySelector('.afk-wf-value');
                if (range && source !== range) range.value = String(v);
                if (number && source !== number) number.value = fs;
                if (label) label.textContent = v !== 1 ? fs + '×' : '1×';
                updateCounts();
            }

            document.getElementById('afk-wf-en').addEventListener('change', function () {
                wen = this.checked;
                updateActive();
                localStorage.setItem(LS('enabled'), String(wen));
            });
            sec.addEventListener('click', function (e) {
                var head = e.target.closest && e.target.closest('.afk-wf-group-head');
                if (!head || !sec.contains(head)) return;
                var group = head.closest('.afk-wf-group');
                var body = group && group.querySelector('.afk-wf-group-body');
                if (!body) return;
                var open = body.hidden;
                body.hidden = !open;
                head.setAttribute('aria-expanded', open ? 'true' : 'false');
                var arrow = head.querySelector('[data-warrow]'); if (arrow) arrow.textContent = open ? '▾' : '▸';
                localStorage.setItem(LS('group_' + head.dataset.wg), String(open));
            });
            sec.addEventListener('input', function (e) {
                var el = e.target;
                if (!el || !el.dataset || !el.dataset.wk) return;
                var v = el.type === 'range' ? Math.round(Number(el.value) * 10) / 10 : Number(el.value);
                sv(el.dataset.wk, v, false);
                syncRow(el.dataset.wk, el);
            });
            sec.addEventListener('change', function (e) {
                var el = e.target;
                if (!el || !el.dataset || !el.dataset.wk) return;
                sv(el.dataset.wk, el.value, true);
                syncRow(el.dataset.wk, el);
            });
        }

        // ── 祝福卷軸倍率：已合併到 hookGain 中，此處只保留旗標 ──
        function hookBless() {
            if (window.__afkWfBl) return;
            window.__afkWfBl = true;
        }

        function installWelfareHooks() {
            injUI();
            hookKillMob(); hookExpRouting(); hookGain(); hookDmgHit(); hookDef(); hookAllyDef(); hookCard(); hookBless(); hookRegen(); hookAllyRegen(); hookPotionRecovery(); hookAttackIntervals(); hookCastSpd();
            var ready = !!(document.getElementById('afk-welfare-sec') && window.__afkWfKm && window.__afkWfGi &&
                window.__afkWfExpRouting && window.__afkWfPotion && window.__afkWfAspd &&
                window.__afkWfPD && window.__afkWfPA && window.__afkWfTH && window.__afkWfCD &&
                window.__afkWfDamageLog && window.__afkWfAllyDamageBoundary &&
                window.__afkWfSourceAllies && window.__afkWfSourceSummon && window.__afkWfSED &&
                window.__afkWfSummonAttack && window.__afkWfIllusion && window.__afkWfRg &&
                window.__afkWfAR && window.__afkWfCs && window.__afkWfDe && window.__afkWfAl && window.__afkWfCa);
            if (ready) AFKRuntime.stopEvery('welfare:install');
        }
        AFKRuntime.every('welfare:install', installWelfareHooks, 600);
    }

    // ============================================================
    //  📚 收藏分頁開關（hook 各 render 函式，在每個物品卡片加 toggle 按鈕）
    // ============================================================
    function initCollectionToggleModule() {
        var _iconMap = null;
        var CARD_OVERRIDE_PREFIX = 'afk_collection_card_overrides_';
        var BOOL_OVERRIDE_PREFIX = 'afk_collection_overrides_';
        var CARD_TIER_SCORES = [0, 1, 10, 100];
        var _applyingCardOverrides = false;
        var _applyingBoolOverrides = false;

        function cardModeKey() {
            if (typeof player === 'undefined' || !player) return 'normal';
            var classic = !!player.classicMode;
            var traditional = !!player.traditionalMode;
            if (classic && traditional) return 'classic_traditional';
            if (classic) return 'classic';
            if (traditional) return 'traditional';
            return 'normal';
        }

        function cardOverrideKey() {
            return CARD_OVERRIDE_PREFIX + cardModeKey();
        }
        function boolOverrideKey() { return BOOL_OVERRIDE_PREFIX + cardModeKey(); }
        function loadBoolOverrides() {
            try {
                var raw = localStorage.getItem(boolOverrideKey()), parsed = raw ? JSON.parse(raw) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (e) { return {}; }
        }
        function saveBoolOverrides(value) { try { localStorage.setItem(boolOverrideKey(), JSON.stringify(value)); } catch (e) {} }
        function boolDex(type) {
            if (type === 'equip') return 'equipDex';
            if (type === 'relic') return 'relicDex';
            return 'miscDex';
        }
        function applyBoolOverrides() {
            if (_applyingBoolOverrides || typeof player === 'undefined' || !player) return false;
            _applyingBoolOverrides = true;
            var changed = false, all = loadBoolOverrides();
            try {
                ['equip','relic','misc'].forEach(function (type) {
                    var field = boolDex(type), map = all[type] || {};
                    if (!player[field]) player[field] = {};
                    Object.keys(map).forEach(function (id) {
                        var next = !!map[id], cur = !!player[field][id];
                        if (cur === next) return;
                        if (next) player[field][id] = true; else delete player[field][id];
                        changed = true;
                    });
                });
            } finally { _applyingBoolOverrides = false; }
            return changed;
        }
        function rememberBoolOverride(type, id, value, all) {
            all = all || loadBoolOverrides();
            if (!all[type]) all[type] = {};
            all[type][id] = !!value;
            return all;
        }

        function loadCardOverrides() {
            try {
                var raw = localStorage.getItem(cardOverrideKey());
                var parsed = raw ? JSON.parse(raw) : {};
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            } catch (e) {
                return {};
            }
        }

        function saveCardOverrides(overrides) {
            try { localStorage.setItem(cardOverrideKey(), JSON.stringify(overrides)); } catch (e) {}
        }

        function normalizeCardScore(score) {
            score = Number(score);
            if (!Number.isFinite(score)) return 0;
            return Math.max(0, Math.min(100, Math.floor(score)));
        }

        function cardScoreTier(score) {
            score = normalizeCardScore(score);
            return score >= 100 ? 3 : (score >= 10 ? 2 : (score >= 1 ? 1 : 0));
        }

        function applyCardOverrides() {
            if (_applyingCardOverrides || typeof player === 'undefined' || !player) return false;
            _applyingCardOverrides = true;
            var changed = false;
            try {
                if (!player.cardDex) player.cardDex = {};
                var overrides = loadCardOverrides();
                Object.keys(overrides).forEach(function (name) {
                    var score = normalizeCardScore(overrides[name]);
                    var current = normalizeCardScore(player.cardDex[name]);
                    if (current === score) return;
                    if (score > 0) player.cardDex[name] = score;
                    else delete player.cardDex[name];
                    changed = true;
                });
            } finally {
                _applyingCardOverrides = false;
            }
            return changed;
        }

        function rememberCardOverride(name, score) {
            if (!name) return;
            var overrides = loadCardOverrides();
            overrides[name] = normalizeCardScore(score);
            saveCardOverrides(overrides);
        }

        function refreshAfterCardChange() {
            if (typeof calcStats === 'function') calcStats();
            if (typeof updateUI === 'function') updateUI();
            if (typeof saveGame === 'function') saveGame();
            if (typeof renderCardBook === 'function') renderCardBook();
        }

        function ensureIconMap() {
            if (_iconMap) return;
            if (typeof DB === 'undefined' || !DB.items || typeof getIconUrl !== 'function') return;
            _iconMap = {};
            for (var id in DB.items) {
                try {
                    var url = getIconUrl(DB.items[id]);
                    if (url) _iconMap[url] = id;
                } catch (e) {}
            }
        }

        // ── 全域 toggle 函式 ──
        window.toggleEquipDex = function (id) {
            if (!player) return;
            if (!player.equipDex) player.equipDex = {};
            if (player.equipDex[id]) { delete player.equipDex[id]; } else { player.equipDex[id] = true; }
            var all = rememberBoolOverride('equip', id, !!player.equipDex[id]); saveBoolOverrides(all);
            if (typeof saveEquipDex === 'function') saveEquipDex();
            if (typeof calcStats === 'function') calcStats();
            if (typeof saveGame === 'function') saveGame();
            if (typeof renderEquipBook === 'function') renderEquipBook();
        };

        window.toggleRelicDex = function (id) {
            if (!player) return;
            if (!player.relicDex) player.relicDex = {};
            if (player.relicDex[id]) { delete player.relicDex[id]; } else { player.relicDex[id] = true; }
            var all = rememberBoolOverride('relic', id, !!player.relicDex[id]); saveBoolOverrides(all);
            if (typeof saveRelicDex === 'function') saveRelicDex();
            if (typeof calcStats === 'function') calcStats();
            if (typeof saveGame === 'function') saveGame();
            if (typeof renderRelicBook === 'function') renderRelicBook();
        };

        window.setCardDexTier = function (name, tier) {
            if (typeof player === 'undefined' || !player || !name) return;
            if (!player.cardDex) player.cardDex = {};
            tier = Math.max(0, Math.min(3, Number(tier) || 0));
            var score = CARD_TIER_SCORES[tier];
            if (score > 0) player.cardDex[name] = score;
            else delete player.cardDex[name];
            rememberCardOverride(name, score);
            refreshAfterCardChange();
        };

        window.toggleMiscDex = function (id) {
            if (!player) return;
            if (!player.miscDex) player.miscDex = {};
            if (player.miscDex[id]) { delete player.miscDex[id]; } else { player.miscDex[id] = true; }
            var all = rememberBoolOverride('misc', id, !!player.miscDex[id]); saveBoolOverrides(all);
            if (typeof saveMiscDex === 'function') saveMiscDex();
            if (typeof calcStats === 'function') calcStats();
            if (typeof saveGame === 'function') saveGame();
            if (typeof renderMiscBook === 'function') renderMiscBook();
        };

        // ── Hook 一個 render 函式，在它執行後呼叫 after ──
        function hook(name, after) {
            if (typeof window[name] !== 'function' || window[name].__afkColTg) return;
            var orig = window[name];
            window[name] = function () {
                var r = orig.apply(this, arguments);
                try { after(); } catch (e) {}
                return r;
            };
            window[name].__afkColTg = true;
        }

        function makeBtn(got) {
            var btn = document.createElement('button');
            btn.className = 'afk-col-toggle' + (got ? ' active' : '');
            btn.textContent = got ? '☑ 已登錄' : '☐ 未登錄';
            btn.setAttribute('aria-pressed', got ? 'true' : 'false');
            return btn;
        }

        function makeCardTierControls(name, score) {
            var tier = cardScoreTier(score);
            var wrap = document.createElement('div');
            wrap.className = 'afk-card-tier-controls';
            wrap.setAttribute('aria-label', name + '卡片登錄階級');
            [
                { t: 0, label: '未', title: '未登錄' },
                { t: 1, label: '普', title: '普卡' },
                { t: 2, label: '銀', title: '銀卡' },
                { t: 3, label: '金', title: '金卡' }
            ].forEach(function (opt) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'afk-card-tier-btn afk-card-tier-' + opt.t + (tier === opt.t ? ' active' : '');
                btn.textContent = opt.label;
                btn.title = '設為' + opt.title;
                btn.setAttribute('aria-pressed', tier === opt.t ? 'true' : 'false');
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.setCardDexTier(name, opt.t);
                });
                wrap.appendChild(btn);
            });
            return wrap;
        }

        // ── 在容器內每個物品卡片加 toggle 按鈕（用圖示 URL 反查 item id）──
        function addTogglesByIcon(containerId, dexCheck, toggleFn) {
            var body = document.getElementById(containerId);
            if (!body) return;
            ensureIconMap();
            if (!_iconMap) return;
            var cards = body.querySelectorAll('[class*="rounded-lg"][class*="bg-slate-800"]');
            cards.forEach(function (card) {
                if (card.querySelector('.afk-col-toggle')) return;
                var img = card.querySelector('img');
                if (!img) return;
                var src = img.getAttribute('src');
                if (!src) return;
                var id = _iconMap[src];
                if (!id) return;
                var got = dexCheck(id);
                var btn = makeBtn(got);
                btn.onclick = function (e) { e.stopPropagation(); toggleFn(id); };
                card.appendChild(btn);
            });
        }

        // ── 卡片收集冊：優先由圖片 alt 取得真實怪名，未取得而顯示「？？？」時也能登錄 ──
        function addCardToggles() {
            var body = document.getElementById('card-book-body');
            if (!body) return;
            var cards = body.querySelectorAll('[class*="rounded-lg"][class*="bg-slate-800"]');
            cards.forEach(function (card) {
                if (card.querySelector('.afk-card-tier-controls')) return;
                var img = card.querySelector('img[alt]:not([alt=""])');
                var name = img ? img.getAttribute('alt').trim() : '';
                if (!name || name === '？？？') {
                    var nameEl = card.querySelector('.font-bold');
                    name = nameEl ? nameEl.textContent.trim() : '';
                }
                if (!name || name === '？？？') return;
                var score = (player.cardDex && player.cardDex[name]) || 0;
                card.appendChild(makeCardTierControls(name, score));
            });
        }

        function hookCardStateFlow() {
            if (typeof window.mergeSharedIntoPlayer === 'function' && !window.mergeSharedIntoPlayer.__afkCardOverride) {
                var origMerge = window.mergeSharedIntoPlayer;
                window.mergeSharedIntoPlayer = function (which) {
                    var changed = origMerge.apply(this, arguments);
                    var cardChanged = (which === undefined || which === 'card') ? applyCardOverrides() : false;
                    var boolChanged = applyBoolOverrides();
                    return !!(changed || cardChanged || boolChanged);
                };
                window.mergeSharedIntoPlayer.__afkCardOverride = true;
            }

            if (typeof window.loadSharedCollections === 'function' && !window.loadSharedCollections.__afkCardOverride) {
                var origLoad = window.loadSharedCollections;
                window.loadSharedCollections = function () {
                    var result = origLoad.apply(this, arguments);
                    applyCardOverrides();
                    applyBoolOverrides();
                    return result;
                };
                window.loadSharedCollections.__afkCardOverride = true;
            }

            if (typeof window.cardAddScore === 'function' && !window.cardAddScore.__afkCardOverride) {
                var origAddScore = window.cardAddScore;
                window.cardAddScore = function (name) {
                    applyCardOverrides();
                    var result = origAddScore.apply(this, arguments);
                    var overrides = loadCardOverrides();
                    if (Object.prototype.hasOwnProperty.call(overrides, name)) {
                        rememberCardOverride(name, player.cardDex && player.cardDex[name]);
                    }
                    return result;
                };
                window.cardAddScore.__afkCardOverride = true;
            }
            [['registerEquipObtained','equip'],['registerRelicObtained','relic'],['registerMiscObtained','misc']].forEach(function (pair) {
                var name = pair[0], type = pair[1];
                if (typeof window[name] !== 'function' || window[name].__afkBoolOverride) return;
                var orig = window[name];
                window[name] = function (id) {
                    var result = orig.apply(this, arguments), field = boolDex(type);
                    if (id && player && player[field] && player[field][id]) {
                        var all = rememberBoolOverride(type, id, true); saveBoolOverrides(all);
                    }
                    return result;
                };
                window[name].__afkBoolOverride = true;
            });
        }

        function flattenMap(map) {
            var out = [], seen = {};
            if (!map) return out;
            Object.keys(map).forEach(function (key) { (map[key] || []).forEach(function (id) { if (!seen[id]) { seen[id] = true; out.push(id); } }); });
            return out;
        }
        function currentIds(type) {
            try {
                if (type === 'equip') return (EQUIP_CAT_ITEMS[_equipBookCat] || []).slice();
                if (type === 'relic') return (RELIC_CAT_ITEMS[_relicBookCat] || []).slice();
                if (type === 'misc') return (MISC_CAT_ITEMS[_miscBookCat] || []).slice();
                return (CARD_REGION_MOBS[_cardBookRegion] || []).slice();
            } catch (e) { return []; }
        }
        function allIds(type) {
            try {
                if (type === 'equip') return flattenMap(EQUIP_CAT_ITEMS);
                if (type === 'relic') return flattenMap(RELIC_CAT_ITEMS);
                if (type === 'misc') return flattenMap(MISC_CAT_ITEMS);
                return flattenMap(CARD_REGION_MOBS);
            } catch (e) { return []; }
        }
        function confirmWhole(message, run) {
            if (typeof gameConfirm === 'function') { gameConfirm({ title:'整本收藏批次設定', message:message, okText:'套用', danger:true, onOk:run }); return; }
            if (typeof confirm !== 'function' || confirm(message)) run();
        }
        function bulkBool(type, whole, value) {
            var run = function () {
                var ids = whole ? allIds(type) : currentIds(type), field = boolDex(type), all = loadBoolOverrides();
                if (!player[field]) player[field] = {};
                ids.forEach(function (id) { if (value) player[field][id] = true; else delete player[field][id]; all = rememberBoolOverride(type, id, value, all); });
                saveBoolOverrides(all);
                var saver = type === 'equip' ? window.saveEquipDex : (type === 'relic' ? window.saveRelicDex : window.saveMiscDex);
                if (typeof saver === 'function') saver();
                if (typeof calcStats === 'function') calcStats();
                if (typeof saveGame === 'function') saveGame();
                var renderer = type === 'equip' ? window.renderEquipBook : (type === 'relic' ? window.renderRelicBook : window.renderMiscBook);
                if (typeof renderer === 'function') renderer();
            };
            if (whole) confirmWhole('確定要' + (value ? '開啟' : '關閉') + '整本收藏嗎？', run); else run();
        }
        function bulkCards(whole, tier) {
            var run = function () {
                var names = whole ? allIds('card') : currentIds('card'), overrides = loadCardOverrides(), score = CARD_TIER_SCORES[tier];
                if (!player.cardDex) player.cardDex = {};
                names.forEach(function (name) { if (score) player.cardDex[name] = score; else delete player.cardDex[name]; overrides[name] = score; });
                saveCardOverrides(overrides); refreshAfterCardChange();
            };
            if (whole) confirmWhole('確定要把整本怪物收藏設為' + ['未登錄','普卡','銀卡','金卡'][tier] + '嗎？', run); else run();
        }
        function bulkRow(label, type, whole) {
            var row = document.createElement('div'); row.className = 'afk-col-bulk-row afk-col-type-' + type + (whole ? ' afk-col-whole-row' : ' afk-col-page-row');
            var title = document.createElement('span'); title.textContent = label; row.appendChild(title);
            if (type === 'card') {
                ['未','普','銀','金'].forEach(function (text, tier) { var b = document.createElement('button'); b.textContent = text; b.onclick = function () { bulkCards(whole, tier); }; row.appendChild(b); });
            } else {
                [['全部開啟',true],['全部關閉',false]].forEach(function (x) { var b = document.createElement('button'); b.textContent = x[0]; b.onclick = function () { bulkBool(type, whole, x[1]); }; row.appendChild(b); });
            }
            return row;
        }
        function addBulkControls(containerId, type) {
            var body = document.getElementById(containerId); if (!body) return;
            var book = document.getElementById(containerId.replace('-body', ''));
            var bookCard = book && book.firstElementChild;
            var header = bookCard && bookCard.firstElementChild;
            var wholeId = 'afk-col-whole-' + type;
            if (header && !document.getElementById(wholeId)) {
                var whole = document.createElement('div'); whole.id = wholeId; whole.className = 'afk-col-whole';
                whole.appendChild(bulkRow('整本', type, true));
                var close = header.querySelector('button[onclick*="close"]');
                header.insertBefore(whole, close || null);
            }
            var oldPage = body.querySelector('.afk-col-page'); if (oldPage) oldPage.remove();
            var heading = body.firstElementChild;
            if (heading) {
                var page = document.createElement('div'); page.className = 'afk-col-page';
                page.appendChild(bulkRow('本頁', type, false)); heading.appendChild(page);
            }
        }

        function hookCardRender() {
            if (typeof window.renderCardBook !== 'function' || window.renderCardBook.__afkCardTier) return;
            var orig = window.renderCardBook;
            window.renderCardBook = function () {
                applyCardOverrides();
                var result = orig.apply(this, arguments);
                try { addCardToggles(); addBulkControls('card-book-body', 'card'); } catch (e) {}
                return result;
            };
            window.renderCardBook.__afkCardTier = true;
        }

        // ── Hook 各 render 函式 ──
        hook('renderEquipBook', function () {
            addTogglesByIcon('equip-book-body', function (id) { return !!(player.equipDex && player.equipDex[id]); }, window.toggleEquipDex);
            addBulkControls('equip-book-body', 'equip');
        });
        hook('renderRelicBook', function () {
            addTogglesByIcon('relic-book-body', function (id) { return !!(player.relicDex && player.relicDex[id]); }, window.toggleRelicDex);
            addBulkControls('relic-book-body', 'relic');
        });
        hook('renderMiscBook', function () {
            addTogglesByIcon('misc-book-body', function (id) { return !!(player.miscDex && player.miscDex[id]); }, window.toggleMiscDex);
            addBulkControls('misc-book-body', 'misc');
        });
        hookCardStateFlow();
        hookCardRender();
        applyCardOverrides();
        applyBoolOverrides();

        window.addEventListener('storage', function (e) {
            if (!e) return;
            if (e.key === cardOverrideKey()) {
                if (applyCardOverrides()) {
                    if (typeof calcStats === 'function') calcStats();
                    if (typeof renderCardBook === 'function') renderCardBook();
                }
                return;
            }
            if (e.key !== boolOverrideKey() || !applyBoolOverrides()) return;
            if (typeof calcStats === 'function') calcStats();
            if (document.getElementById('equip-book-body') && typeof renderEquipBook === 'function') renderEquipBook();
            if (document.getElementById('relic-book-body') && typeof renderRelicBook === 'function') renderRelicBook();
            if (document.getElementById('misc-book-body') && typeof renderMiscBook === 'function') renderMiscBook();
        });

        console.log('[AFK] CollectionToggle hooks OK — 怪物收藏支援未登錄／普卡／銀卡／金卡四態。');
    }

    // ============================================================
    //  CSS
    // ============================================================
    (function () {
        if (document.getElementById('afk-main-css')) return;
        var s = document.createElement('style'); s.id = 'afk-main-css';
        s.textContent =
        '#as-h{position:absolute;z-index:2147483647;width:40px;height:40px;left:10px;bottom:10px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px!important;color:#64ffda;text-shadow:0 0 16px rgba(100,255,218,0.6);background:rgba(8,12,28,0.92);border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);box-shadow:0 12px 40px rgba(0,0,0,0.6);cursor:pointer;user-select:none;transition:transform 0.2s}' +
        '#as-h:hover{transform:scale(1.15)}#as-h.off{color:#94a3b8;text-shadow:none}' +
        '#as-p{position:fixed;z-index:2147483646;width:280px;max-height:calc(100vh - 20px);overflow-y:auto;background:rgba(8,12,28,0.94);border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(28px);border-radius:24px;box-shadow:0 12px 40px rgba(0,0,0,0.6);padding:16px;color:#e2e8f0;font-family:system-ui,sans-serif;font-size:13px;opacity:0;visibility:hidden;transition:opacity 0.25s,visibility 0.25s;left:10px;right:auto;bottom:70px;top:auto}' +
        'body.m-mobile #as-p{width:min(280px,calc(100vw - 16px));}' +
        '#as-p.visible{opacity:1;visibility:visible}' +
        '.as-hd{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08)}' +
        '.as-tl{font-weight:800;font-size:1.1em;color:#64ffda}' +
        '#as-pb{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);padding:2px 10px;border-radius:14px;cursor:pointer;color:#e2e8f0;font-size:1em;line-height:1.4}' +
        '.as-ts{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:8px 0}' +
        '.as-tb{border:1px solid rgba(255,255,255,0.08);background:rgba(16,24,44,0.5);color:#94a3b8;padding:8px;border-radius:12px;cursor:pointer;font-weight:700;font-size:0.85em;text-align:center}' +
        '.as-tb.active{background:#64ffda;color:#0a0f1e}' +
        '.as-sec{background:rgba(16,24,44,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px;margin-bottom:8px}' +
        '.as-st{font-weight:700;color:#e2e8f0;margin-bottom:8px}.as-r{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0}' +
        '.as-lb{color:#94a3b8;font-weight:600;font-size:0.85em}' +
        '.as-ip{width:70px;padding:5px 8px;background:rgba(8,12,28,0.8);border:1px solid rgba(255,255,255,0.08);color:#e2e8f0;border-radius:8px;text-align:center;font-weight:600;font-size:0.85em;outline:none}' +
        '.as-bt{border:1px solid rgba(255,255,255,0.08);background:rgba(16,24,44,0.6);color:#e2e8f0;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.8em}' +
        '.as-bt.active{border-color:#64ffda;color:#0a0f1e;background:#64ffda}' +
        '.as-on{background:#64ffda!important;color:#0a0f1e!important}.as-off{color:#94a3b8!important}' +
        '.as-g3,.as-profile-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.as-profile-grid .as-bt{padding-left:4px;padding-right:4px;font-size:.72em}.as-prof-title{margin-top:9px}.as-sl{width:100%;accent-color:#64ffda;height:4px;cursor:pointer}' +
        '.as-pl{display:inline-block;padding:2px 10px;border-radius:20px;border:1px solid rgba(100,255,218,0.25);color:#64ffda;font-weight:700;font-size:0.75em}' +
        '.as-ht{color:#94a3b8;font-size:0.75em;line-height:1.5;margin-top:4px}.as-wn{color:#f59e0b}' +
        '.afk-quick-header{position:sticky!important;top:0!important;z-index:13!important;margin-top:0!important;padding-top:0!important;background:#1e293b!important}' +
        '.afk-isearch,.afk-isearch-plus{position:sticky!important;top:var(--afk-quick-header-height,42px)!important;z-index:12!important;padding:4px 0 6px!important;background:#1e293b!important;display:flex!important;gap:6px!important;align-items:center!important;border-bottom:1px solid #334155!important;margin:0 0 2px!important;flex-wrap:wrap!important}' +
        '.afk-isearch input,.afk-isearch-plus input{flex:1!important;min-width:60px!important;background:#0f172a!important;border:1px solid #475569!important;border-radius:8px!important;color:#e2e8f0!important;padding:6px 10px!important;font-size:13px!important;outline:none!important}' +
        '.afk-isearch input:focus{border-color:#b89243!important}.afk-isearch input::placeholder{color:#64748b!important}' +
        '.afk-cs-slot,.afk-cs-attr{flex:none!important;width:110px!important;background:#0f172a!important;border:1px solid #475569!important;border-radius:8px!important;color:#e2e8f0!important;padding:6px 4px!important;font-size:11px!important;outline:none!important;cursor:pointer!important}' +
        '.afk-cs-slot:focus,.afk-cs-attr:focus{border-color:#b89243!important}' +
        '.afk-cs-slot option,.afk-cs-attr option{background:#1e293b!important;color:#e2e8f0!important}' +
        '#tab-weapons,#tab-armors,#tab-items{overflow:hidden!important}' +
        '.afk-virtual-host{display:block;flex:1 1 auto;min-height:1px;overflow:hidden;contain:layout style}' +
        '.afk-virtual-rows{display:block;min-height:0;overflow:hidden}' +
        '.afk-virtual-spacer{display:block!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;pointer-events:none!important}' +
        '.afk-inv-pager{flex:none;display:flex;align-items:center;justify-content:center;gap:4px;min-height:31px;margin-top:5px;padding:4px;border-top:1px solid #334155;background:#172033}.afk-inv-pager button{min-width:27px;height:25px;padding:2px 7px;border:1px solid #475569;border-radius:6px;background:#1e293b;color:#cbd5e1;font:800 9px system-ui;cursor:pointer}.afk-inv-pager button:hover:not(:disabled){border-color:#38bdf8;color:#e0f2fe}.afk-inv-pager button.active{border-color:#f59e0b;background:#78350f;color:#fef3c7}.afk-inv-pager button:disabled{opacity:.35;cursor:not-allowed}.afk-inv-pager span{margin-left:5px;color:#94a3b8;font:700 8px system-ui;white-space:nowrap}@media(max-width:760px){.afk-inv-pager{gap:2px}.afk-inv-pager button{min-width:24px;padding:2px 5px}.afk-inv-pager span{width:100%;margin:1px 0 0;text-align:center}}' +
        '.afk-inv-placeholder{padding:24px 10px;color:#94a3b8;text-align:center;font-size:13px;pointer-events:none}' +
        '.afk-has-add-fab{padding-bottom:72px!important}' +
        '#afk-add-item-fab{display:none;position:absolute;right:12px;bottom:12px;z-index:30;align-items:center;justify-content:center;width:44px;min-width:44px;height:44px;padding:0;border:1px solid #34d399;border-radius:50%;background:linear-gradient(135deg,#065f46,#0f766e);color:#d1fae5;font:900 25px/1 system-ui;cursor:pointer;box-shadow:0 7px 22px rgba(0,0,0,.55),0 0 0 2px rgba(15,23,42,.72)}' +
        '#afk-add-item-fab.visible{display:flex}' +
        '#afk-add-item-fab:hover{filter:brightness(1.18);transform:translateY(-1px)}' +
        '#afk-item-add-panel{position:fixed;inset:0;z-index:2147483645;background:rgba(2,6,23,.42);font-family:system-ui,sans-serif}' +
        '.afk-add-dialog{position:fixed;box-sizing:border-box;max-height:min(560px,calc(100vh - 24px));display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #475569;border-radius:12px;background:#0f172a;color:#e2e8f0;box-shadow:0 18px 60px rgba(0,0,0,.72)}' +
        '.afk-add-dialog header{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#6ee7b7}' +
        '.afk-add-close{width:28px;height:28px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#e2e8f0;font-size:18px;line-height:1;cursor:pointer}' +
        '.afk-add-search,.afk-add-category,.afk-add-sherine{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid #475569;border-radius:8px;background:#020617;color:#f8fafc;outline:none}' +
        '.afk-add-search:focus,.afk-add-category:focus,.afk-add-sherine:focus{border-color:#34d399}' +
        '.afk-add-category option,.afk-add-category optgroup,.afk-add-sherine option{background:#0f172a;color:#e2e8f0}' +
        '.afk-add-sherine-wrap{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px;color:#86efac;font-size:11px;font-weight:700}.afk-add-sherine-wrap.hidden{display:none}' +
        '.afk-add-note{color:#94a3b8;font-size:10px}' +
        '.afk-add-results{min-height:72px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding-right:2px}' +
        '.afk-add-result{min-width:0;display:flex;align-items:center;gap:7px;padding:7px;border:1px solid #334155;border-radius:8px;background:#1e293b;color:#e2e8f0;text-align:left;cursor:pointer}' +
        '.afk-add-result:hover{border-color:#34d399;background:#26354a}' +
        '.afk-add-result img{width:28px;height:28px;object-fit:contain;flex:none}' +
        '.afk-add-result span{min-width:0;display:flex;flex-direction:column;gap:2px}.afk-add-result b,.afk-add-result small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.afk-add-result b{font-size:11px}.afk-add-result small{color:#94a3b8;font-size:9px}' +
        '@media(max-width:520px){.afk-add-results{grid-template-columns:1fr}#afk-add-item-fab{right:8px;bottom:8px}.afk-has-add-fab{padding-bottom:66px!important}}' +
        '.afk-rv-option{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid rgba(71,85,105,.45);cursor:pointer}' +
        '.afk-rv-option input[type="checkbox"],#afk-wf-en,.afk-quick-header input[type="checkbox"]{appearance:none;-webkit-appearance:none;position:relative;box-sizing:border-box;width:34px!important;min-width:34px;height:19px!important;margin:0;border:1px solid #475569;border-radius:999px;background:#1e293b;cursor:pointer;transition:.18s;vertical-align:middle}' +
        '.afk-rv-option input[type="checkbox"]:before,#afk-wf-en:before,.afk-quick-header input[type="checkbox"]:before{content:"";position:absolute;left:2px;top:2px;width:13px;height:13px;border-radius:50%;background:#94a3b8;box-shadow:0 1px 3px rgba(0,0,0,.55);transition:.18s}' +
        '.afk-rv-option input[type="checkbox"]:checked,#afk-wf-en:checked,.afk-quick-header input[type="checkbox"]:checked{border-color:#10b981;background:#065f46;box-shadow:0 0 0 1px rgba(16,185,129,.18)}' +
        '.afk-rv-option input[type="checkbox"]:checked:before,#afk-wf-en:checked:before,.afk-quick-header input[type="checkbox"]:checked:before{left:17px;background:#a7f3d0}' +
        '.afk-rv-option input[type="checkbox"]:focus-visible,#afk-wf-en:focus-visible,.afk-quick-header input[type="checkbox"]:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}' +
        '.afk-survival-title{font-weight:800;color:#f8fafc;margin-bottom:9px;font-size:13px}' +
        '.afk-survival-master{border:1px solid rgba(16,185,129,.35);border-radius:8px;padding:8px;background:rgba(6,95,70,.22);font-weight:800}' +
        '.afk-survival-section{display:block;margin-top:8px;padding:8px;border:1px solid #334155;border-radius:8px;background:rgba(15,23,42,.58)}' +
        '.afk-survival-section>b{display:block;margin-bottom:2px;color:#cbd5e1}' +
        '.afk-survival-number{display:grid;grid-template-columns:1fr 58px 14px;align-items:center;gap:5px;padding-top:7px;color:#cbd5e1}' +
        '.afk-survival-number input{box-sizing:border-box;width:58px;padding:4px;background:#020617;border:1px solid #475569;border-radius:5px;color:#fff;text-align:center}' +
        '.afk-survival-number em{color:#94a3b8;font-style:normal}' +
        '.afk-rv-warning{margin-top:8px;color:#fbbf24}' +
        '.afk-survival-hint{margin-top:8px;color:#94a3b8;font-size:11px;line-height:1.45}' +
        '.afk-survival-disabled .afk-survival-section{opacity:.55}' +
        '.afk-stat-inline{display:inline-flex;align-items:flex-end;gap:3px;margin-right:4px;color:#94a3b8;font-size:9px;line-height:1}' +
        '.afk-stat-inline label{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}' +
        '.afk-stat-inline small{font-size:8px;white-space:nowrap;color:#94a3b8}' +
        '.afk-stat-inline input{box-sizing:border-box;width:42px;height:25px;padding:2px;border:1px solid #475569;border-radius:5px;background:#0f172a;color:#f8fafc;font:700 11px/1 system-ui;text-align:center;outline:none}' +
        '.afk-stat-inline input:focus{border-color:#34d399;box-shadow:0 0 0 1px rgba(52,211,153,.25)}' +
        '.afk-stat-inline input:disabled{opacity:.45;cursor:not-allowed}' +
        '.afk-editor-panel{margin:0 0 10px;padding:10px;border:1px solid #475569;border-radius:10px;background:rgba(15,23,42,.82);color:#e2e8f0}' +
        '.afk-editor-panel header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;color:#fbbf24}' +
        '.afk-editor-panel header small{color:#94a3b8;font-size:10px;font-weight:500}' +
        '.afk-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}' +
        '.afk-stat-row{display:grid;grid-template-columns:1fr 52px;align-items:center;gap:4px;padding:5px;border:1px solid #334155;border-radius:7px;background:#111827;color:#cbd5e1;font-size:11px}' +
        '.afk-stat-row input{width:52px;box-sizing:border-box;padding:4px;background:#020617;border:1px solid #475569;border-radius:5px;color:#fff;text-align:center}' +
        '.afk-stat-row small{grid-column:1/-1;color:#94a3b8}.afk-stat-row small b{color:#34d399}' +
        '.afk-editor-apply,.afk-equip-edit-btn{border:1px solid #0f766e!important;background:#115e59!important;color:#ccfbf1!important;font-weight:800!important;padding:8px!important;border-radius:7px!important;cursor:pointer!important}' +
        '.afk-equip-replace-btn{border:1px solid #0284c7!important;background:linear-gradient(180deg,#075985,#0c4a6e)!important;color:#e0f2fe!important;font-weight:900!important;padding:8px!important;border-radius:7px!important;cursor:pointer!important}.afk-equip-replace-btn:hover{filter:brightness(1.16)}' +
        '.afk-editor-panel>.afk-editor-apply{width:100%;margin-top:8px}' +
        '.classic-skill-cell{position:relative!important}' +
        '.afk-skill-toggle{position:absolute;right:2px;bottom:2px;z-index:8;min-width:27px;padding:2px 4px;border:1px solid #475569;border-radius:7px;background:linear-gradient(180deg,#263449,#172033);color:#94a3b8;font-size:8px;font-weight:900;line-height:12px;text-align:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.65)}' +
        '.afk-skill-toggle.on{border-color:#10b981;background:linear-gradient(180deg,#08755a,#065f46);color:#d1fae5}.afk-skill-toggle.granted{border-color:#a78bfa;background:linear-gradient(180deg,#5b21b6,#4c1d95);color:#ede9fe;cursor:not-allowed}' +
        '.afk-skill-bulk{display:flex;align-items:center;gap:6px;margin:0 0 8px;padding:7px 9px;border:1px solid #334155;border-radius:9px;background:linear-gradient(135deg,#0f172a,#172033);color:#cbd5e1;font-size:11px}.afk-skill-bulk>span{font-weight:900;color:#67e8f9;margin-right:auto}.afk-skill-bulk select,.afk-skill-bulk button{padding:5px 8px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#e2e8f0;font:800 10px system-ui;cursor:pointer}.afk-skill-bulk button:hover{border-color:#22d3ee;color:#cffafe}' +
        '#afk-mastery-badge{min-width:86px;max-width:145px;height:36px;display:flex;align-items:center;justify-content:center;gap:5px;margin-left:auto;padding:3px 8px;border:1px solid #d4a017;border-radius:9px;background:linear-gradient(135deg,#3a2f12,#8a650c,#241c0c);color:#fde68a;font:900 11px system-ui;cursor:pointer;box-shadow:0 0 10px rgba(212,160,23,.25)}#afk-mastery-badge img{width:24px;height:24px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(250,204,21,.55))}#afk-mastery-badge span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#afk-mastery-badge.empty{border-style:dashed;color:#cbd5e1;filter:saturate(.55)}' +
        '#afk-mastery-panel,#afk-material-guide{position:fixed;z-index:2147483647;box-sizing:border-box;width:min(360px,calc(100vw - 16px));max-height:min(620px,calc(100vh - 16px));overflow:auto;padding:10px;border:1px solid #475569;border-radius:12px;background:#0f172a;color:#e2e8f0;box-shadow:0 18px 60px rgba(0,0,0,.78);font-family:system-ui,sans-serif}' +
        '.afk-mastery-title,.afk-material-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #334155}.afk-mastery-title img{width:38px;height:38px;object-fit:contain}.afk-mastery-title div{display:flex;flex-direction:column}.afk-mastery-title b,.afk-material-head b{color:#fde68a}.afk-mastery-title small{color:#94a3b8}.afk-material-head{justify-content:space-between}.afk-material-head button{border:0;background:transparent;color:#94a3b8;font-size:20px;cursor:pointer}' +
        '.afk-mastery-option,.afk-material-route{width:100%;display:flex;flex-direction:column;gap:2px;margin-top:5px;padding:8px 10px;border:1px solid #334155;border-radius:8px;background:#1e293b;color:#e2e8f0;text-align:left;cursor:pointer}.afk-mastery-option:hover,.afk-mastery-option.active{border-color:#f59e0b;background:#3a2f12}.afk-mastery-option span,.afk-material-route span{color:#94a3b8;font-size:10px}.afk-material-route.craft:hover{border-color:#f59e0b}.afk-material-route.trial:hover{border-color:#a78bfa;background:#2e1065}.afk-material-route.hunt:hover{border-color:#ef4444}.afk-material-empty{padding:18px 6px;color:#94a3b8;text-align:center}.afk-material-link,.afk-trial-link{display:inline;padding:0;border:0;border-bottom:1px dashed #22d3ee;background:transparent;font:inherit;font-weight:800;cursor:pointer}.afk-material-link{color:#67e8f9}.afk-trial-link{border-bottom-color:#a78bfa}.afk-trial-link:hover{filter:brightness(1.3)}' +
        '#afk-pandora-toggle{flex:none;padding:4px 8px;border:1px solid #7c3aed;border-radius:7px;background:#2e1065;color:#e9d5ff;font:800 10px/1.2 system-ui;cursor:pointer;white-space:nowrap}#afk-pandora-toggle.active{background:#6d28d9;color:#fff;box-shadow:0 0 9px rgba(168,85,247,.35)}#afk-pandora-dock{position:absolute;z-index:9;right:8px;bottom:8px;box-sizing:border-box;width:min(340px,calc(100% - 16px));max-height:calc(100% - 58px);display:flex;flex-direction:column;padding:8px;border:1px solid #7c3aed;border-radius:11px;background:rgba(15,23,42,.97);color:#e2e8f0;box-shadow:0 12px 32px rgba(0,0,0,.65),0 0 16px rgba(124,58,237,.18);font-family:system-ui,sans-serif}#afk-pandora-dock.hidden{display:none}.afk-pandora-dock-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 7px;color:#d8b4fe;font-size:11px}.afk-pandora-dock-head span{color:#fde68a;font-size:9px}.afk-pandora-dock-list{min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.afk-pandora-dock-item{min-width:0;display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:5px;padding:4px;border:1px solid #334155;border-radius:7px;background:#111827}.afk-pandora-dock-item.rare{border-color:#c084fc;box-shadow:inset 0 0 8px rgba(192,132,252,.18)}.afk-pandora-dock-item.sold{opacity:.55}.afk-pandora-dock-item img{width:24px;height:24px;object-fit:contain}.afk-pandora-dock-item>span{min-width:0;display:flex;flex-direction:column}.afk-pandora-dock-item b,.afk-pandora-dock-item small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.afk-pandora-dock-item b{font-size:9px}.afk-pandora-dock-item small{color:#facc15;font-size:8px}.afk-pandora-dock-item button{padding:3px 5px;border:1px solid #7c3aed;border-radius:5px;background:#6d28d9;color:#fff;font:800 8px system-ui;cursor:pointer}.afk-pandora-dock-item button:disabled{border-color:#475569;background:#334155;color:#94a3b8;cursor:not-allowed}.afk-pandora-dock-empty{grid-column:1/-1;padding:22px;color:#94a3b8;text-align:center;font-size:11px}' +
        '.afk-equip-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}' +
        '.afk-equip-editor label{display:flex;flex-direction:column;gap:4px;color:#cbd5e1;font-size:11px}' +
        '.afk-equip-editor input,.afk-equip-editor select{box-sizing:border-box;width:100%;padding:6px;background:#0f172a;border:1px solid #475569;border-radius:6px;color:#fff}' +
        '.afk-equip-editor input:disabled,.afk-equip-editor select:disabled{opacity:.45;cursor:not-allowed}' +
        '.afk-equip-editor small{grid-column:1/-1;color:#94a3b8}' +
        '.afk-qty-editor{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:end;margin-top:8px;padding:9px;border:1px solid #475569;border-radius:8px;background:rgba(15,23,42,.8)}' +
        '.afk-qty-editor label{display:flex;flex-direction:column;gap:4px;color:#cbd5e1;font-size:11px}' +
        '.afk-qty-editor input{box-sizing:border-box;width:100%;padding:7px;background:#020617;border:1px solid #475569;border-radius:6px;color:#fff;font-weight:800;text-align:center}' +
        '.afk-qty-apply{height:34px;padding:5px 12px!important;border-color:#0f766e!important;background:#115e59!important;color:#ccfbf1!important;font-weight:800!important}' +
        '.afk-qty-editor small{grid-column:1/-1;color:#94a3b8;font-size:10px}' +
        'body.m-mobile .afk-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}' +
        'body.m-mobile .afk-equip-editor{grid-template-columns:1fr}' +
        'body.m-mobile .afk-qty-editor{grid-template-columns:1fr}' +
        'body.m-mobile .afk-qty-apply{width:100%}' +
        '.afk-empty-equip-slot{cursor:pointer!important;border:1px dashed rgba(52,211,153,.45)!important;transition:border-color .15s,background .15s}' +
        '.afk-empty-equip-slot:hover,.afk-empty-equip-slot:focus{border-color:#34d399!important;background:#134e4a!important;outline:none}' +
        '#tab-equip .list-item{position:relative}.afk-equip-pick-hint{color:#94a3b8;font-size:10px}' +
        '#afk-equip-picker{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(2,6,23,.6);font-family:system-ui,sans-serif}' +
        '.afk-equip-pick-card{box-sizing:border-box;width:min(460px,100%);max-height:min(620px,calc(100vh - 24px));display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #475569;border-radius:12px;background:#0f172a;color:#e2e8f0;box-shadow:0 18px 60px rgba(0,0,0,.72)}' +
        '.afk-equip-pick-head{display:flex;align-items:center;justify-content:space-between;color:#6ee7b7}.afk-equip-pick-head button{width:28px;height:28px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#e2e8f0;font-size:18px;cursor:pointer}' +
        '.afk-equip-pick-search{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid #475569;border-radius:8px;background:#020617;color:#f8fafc;outline:none}.afk-equip-pick-search:focus{border-color:#34d399}' +
        '.afk-equip-pick-list{min-height:90px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}' +
        '.afk-equip-pick-item{min-width:0;display:flex;align-items:center;gap:7px;padding:8px;border:1px solid #334155;border-radius:8px;background:#1e293b;color:#e2e8f0;text-align:left;cursor:pointer}.afk-equip-pick-item:hover{border-color:#34d399;background:#26354a}.afk-equip-pick-item img{width:30px;height:30px;object-fit:contain;flex:none}.afk-equip-pick-item span{min-width:0;display:flex;flex-direction:column;gap:2px}.afk-equip-pick-item b,.afk-equip-pick-item small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.afk-equip-pick-item b{font-size:11px}.afk-equip-pick-item small{color:#94a3b8;font-size:9px}' +
        '.afk-equip-pick-empty{grid-column:1/-1;padding:28px 8px;color:#94a3b8;text-align:center}' +
        '.afk-col-toggle,.afk-ui-toggle{min-width:58px;padding:4px 8px;border:1px solid #475569;border-radius:7px;background:linear-gradient(180deg,#263449,#172033);color:#94a3b8;font:800 10px/1.2 system-ui;cursor:pointer;transition:.15s;box-shadow:inset 0 1px rgba(255,255,255,.04)}.afk-col-toggle{margin-top:4px}.afk-col-toggle:hover,.afk-ui-toggle:hover{border-color:#38bdf8;color:#e0f2fe}.afk-col-toggle.active,.afk-ui-toggle.active,#as-tog.afk-ui-toggle.active{border-color:#10b981!important;background:linear-gradient(180deg,#08755a,#065f46)!important;color:#d1fae5!important;box-shadow:0 0 0 1px rgba(16,185,129,.18),0 3px 10px rgba(6,95,70,.25)}' +
        '.afk-junk-list-btn{flex:0 0 auto;padding:6px 10px;border:1px solid #b45309;border-radius:7px;background:linear-gradient(180deg,#5b3411,#33200e);color:#fde68a;font:800 11px/1.2 system-ui;cursor:pointer;white-space:nowrap}.afk-junk-list-btn:hover{filter:brightness(1.18)}' +
        '#afk-junk-manager{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(2,6,23,.68);font-family:system-ui,sans-serif}.afk-junk-dialog{box-sizing:border-box;width:min(620px,100%);max-height:min(700px,calc(100vh - 24px));display:flex;flex-direction:column;gap:9px;padding:12px;border:1px solid #78350f;border-radius:13px;background:#0f172a;color:#e2e8f0;box-shadow:0 20px 70px rgba(0,0,0,.78)}.afk-junk-dialog header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:8px;border-bottom:1px solid #334155}.afk-junk-dialog header>div{display:flex;flex-direction:column;gap:2px}.afk-junk-dialog strong{color:#fde68a}.afk-junk-summary{color:#94a3b8;font-size:10px}.afk-junk-close{width:29px;height:29px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#e2e8f0;font-size:18px;cursor:pointer}.afk-junk-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.afk-junk-search{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid #475569;border-radius:8px;background:#020617;color:#f8fafc;outline:none}.afk-junk-search:focus{border-color:#f59e0b}.afk-junk-list{min-height:100px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.afk-junk-row{min-width:0;display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px;border:1px solid #334155;border-radius:8px;background:#1e293b}.afk-junk-row img{width:30px;height:30px;object-fit:contain}.afk-junk-row>span{min-width:0;display:flex;flex-direction:column;gap:2px}.afk-junk-row b,.afk-junk-row small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.afk-junk-row b{font-size:11px}.afk-junk-row small{color:#94a3b8;font-size:9px}.afk-junk-empty{grid-column:1/-1;padding:30px 8px;color:#94a3b8;text-align:center}' +
        '.afk-col-whole,.afk-col-page{display:flex;align-items:center;min-width:0}.afk-col-whole{margin-left:auto;margin-right:10px}.afk-col-page{margin-left:auto}.afk-col-bulk-row{display:flex;align-items:center;gap:4px;padding:3px;border:1px solid rgba(71,85,105,.8);border-radius:9px;background:rgba(15,23,42,.82);box-shadow:inset 0 1px rgba(255,255,255,.04)}.afk-col-bulk-row>span{padding:0 4px;color:#94a3b8;font-size:9px;font-weight:900;white-space:nowrap}.afk-col-bulk-row>button{min-width:48px;padding:5px 8px;border:1px solid #475569;border-radius:6px;background:linear-gradient(180deg,#263449,#172033);color:#dbeafe;font:800 10px/1.2 system-ui;cursor:pointer;white-space:nowrap;transition:.15s}.afk-col-bulk-row>button:hover{border-color:#38bdf8;color:#e0f2fe;transform:translateY(-1px);box-shadow:0 3px 9px rgba(14,165,233,.18)}.afk-col-bulk-row:not(.afk-col-type-card)>button:last-child{border-color:#7f1d1d;background:linear-gradient(180deg,#442029,#29151b);color:#fecaca}.afk-col-type-card>button:nth-of-type(2){color:#f8fafc}.afk-col-type-card>button:nth-of-type(3){color:#e2e8f0}.afk-col-type-card>button:nth-of-type(4){border-color:#b45309;color:#fde68a;background:linear-gradient(180deg,#5b3411,#33200e)}' +
        '@media(max-width:720px){.afk-col-whole{margin-right:5px}.afk-col-bulk-row>span{display:none}.afk-col-bulk-row>button{min-width:38px;padding:5px}.afk-skill-bulk{flex-wrap:wrap}.afk-skill-bulk>span{width:100%}}' +
        '@media(max-width:620px){.afk-junk-list{grid-template-columns:1fr}.afk-junk-tools,.afk-junk-filters{grid-template-columns:1fr}.afk-junk-only{width:100%}}@media(max-width:520px){.afk-equip-pick-list{grid-template-columns:1fr}}' +
        'body>.game-tooltip,body>#pandora-tooltip{z-index:2147483647!important;max-width:min(360px,calc(100vw - 16px))!important;filter:drop-shadow(0 12px 28px rgba(0,0,0,.85))}' +
        '.afk-junk-note{margin:-2px 0 1px;padding:6px 8px;border:1px solid rgba(180,83,9,.35);border-radius:7px;background:rgba(120,53,15,.14);color:#fcd34d;font-size:9px;line-height:1.45}.afk-junk-row.historical{border-style:dashed;border-color:#92400e;background:linear-gradient(135deg,#1e293b,#2b1d16)}.afk-junk-row.historical small:after{content:" · 廢品記憶";color:#f59e0b}.afk-junk-row.historical .afk-ui-toggle{border-color:#b45309;color:#fde68a;background:linear-gradient(180deg,#5b3411,#33200e)}' +
        '#afk-mastery-host{display:block;box-sizing:border-box;margin:-1px 8px 5px;padding-top:4px;border-top:1px solid rgba(71,85,105,.45)}#afk-mastery-badge{box-sizing:border-box!important;width:100%!important;max-width:none!important;min-width:0!important;height:32px!important;display:grid!important;grid-template-columns:25px minmax(0,1fr) auto!important;align-items:center!important;justify-content:stretch!important;gap:7px!important;margin:0!important;padding:3px 8px!important;border-radius:8px!important;text-align:left!important}#afk-mastery-badge img{width:24px!important;height:24px!important}#afk-mastery-badge>span{min-width:0!important;display:flex!important;flex-direction:column!important;gap:0!important;line-height:1.05!important}#afk-mastery-badge small{color:rgba(226,232,240,.68);font-size:7px;font-weight:700;letter-spacing:.08em}#afk-mastery-badge b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}#afk-mastery-badge em{font-style:normal;font-size:8px;opacity:.72}#afk-mastery-badge[data-tone="0"],.afk-mastery-option[data-tone="0"]{--afk-mastery:#f59e0b;--afk-mastery-bg:#3a2f12}#afk-mastery-badge[data-tone="1"],.afk-mastery-option[data-tone="1"]{--afk-mastery:#38bdf8;--afk-mastery-bg:#0c3349}#afk-mastery-badge[data-tone="2"],.afk-mastery-option[data-tone="2"]{--afk-mastery:#34d399;--afk-mastery-bg:#064e3b}#afk-mastery-badge[data-tone="3"],.afk-mastery-option[data-tone="3"]{--afk-mastery:#c084fc;--afk-mastery-bg:#3b1764}#afk-mastery-badge[data-tone="4"],.afk-mastery-option[data-tone="4"]{--afk-mastery:#fb7185;--afk-mastery-bg:#4c1721}#afk-mastery-badge[data-tone="5"],.afk-mastery-option[data-tone="5"]{--afk-mastery:#facc15;--afk-mastery-bg:#493c08}#afk-mastery-badge,.afk-mastery-option{border-color:var(--afk-mastery)!important;background:linear-gradient(135deg,var(--afk-mastery-bg),#111827)!important;color:var(--afk-mastery)!important}#afk-mastery-badge{box-shadow:inset 3px 0 var(--afk-mastery),0 4px 12px rgba(0,0,0,.22)!important}.afk-mastery-option{position:relative;border-left-width:4px!important}.afk-mastery-option.active:after{content:"目前使用";position:absolute;right:8px;top:7px;padding:2px 5px;border-radius:999px;background:var(--afk-mastery);color:#0f172a;font-size:7px;font-weight:900}' +
        '.afk-trial-modal-action{grid-column:1/-1;display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:9px 11px;border:1px solid #8b5cf6;border-radius:9px;background:linear-gradient(135deg,#4c1d95,#2e1065);color:#ede9fe;text-align:left;cursor:pointer;box-shadow:0 4px 14px rgba(76,29,149,.28)}.afk-trial-modal-action:hover{filter:brightness(1.18)}.afk-trial-modal-action b{font-size:12px}.afk-trial-modal-action small{color:#c4b5fd;font-size:9px}' +
        '.afk-skill-toggle{right:4px!important;bottom:4px!important;min-width:48px!important;padding:3px 6px!important;border-radius:999px!important;font-size:8px!important;line-height:12px!important;letter-spacing:.02em!important;backdrop-filter:blur(5px);transition:transform .14s,filter .14s,box-shadow .14s!important}.afk-skill-toggle:hover{transform:translateY(-1px);filter:brightness(1.18)}.afk-skill-toggle.on{box-shadow:0 0 0 1px rgba(52,211,153,.2),0 3px 10px rgba(6,95,70,.4)!important}.afk-skill-toggle.granted{box-shadow:0 0 0 1px rgba(167,139,250,.2),0 3px 10px rgba(76,29,149,.4)!important}.afk-skill-bulk{display:grid!important;grid-template-columns:minmax(90px,1fr) auto auto auto!important;gap:7px!important;padding:8px 9px!important;border-color:#475569!important;border-radius:11px!important;background:linear-gradient(135deg,#111827,#172554)!important;box-shadow:0 5px 18px rgba(0,0,0,.2)!important}.afk-skill-bulk>span{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:5px;align-items:center;margin:0!important}.afk-skill-bulk>span i{grid-row:1/3;font-style:normal;font-size:16px}.afk-skill-bulk>span b{color:#cffafe;font-size:10px}.afk-skill-bulk>span small{color:#64748b;font-size:7px}.afk-skill-bulk select,.afk-skill-bulk button{height:30px!important;border-radius:8px!important}.afk-skill-bulk-on{border-color:#059669!important;background:linear-gradient(180deg,#047857,#065f46)!important;color:#d1fae5!important}.afk-skill-bulk-off{border-color:#9f1239!important;background:linear-gradient(180deg,#881337,#4c0519)!important;color:#ffe4e6!important}.afk-skill-bulk button i{font-style:normal;font-size:12px}#tab-skill>.afk-skill-bulk{position:sticky!important;top:0!important;z-index:40!important;box-sizing:border-box!important;width:min(100%,510px)!important;max-width:510px!important;flex:none!important;margin:0 auto 7px!important;pointer-events:auto!important;isolation:isolate}#tab-skill>.afk-skill-bulk *{pointer-events:auto!important}#tab-skill>.classic-skill-window{flex:none!important}.afk-skill-bulk select,.afk-skill-bulk button{position:relative!important;z-index:1!important;touch-action:manipulation}@media(max-width:720px){.afk-skill-bulk{grid-template-columns:1fr 1fr!important}.afk-skill-bulk>span{grid-column:1/-1;width:auto!important}.afk-skill-element{grid-column:1/-1}}' +
        '.afk-junk-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.afk-junk-filters select{box-sizing:border-box;width:100%;min-width:0;padding:7px 9px;border:1px solid #475569;border-radius:8px;background:#111827;color:#e2e8f0;outline:none}.afk-junk-filters select:focus{border-color:#f59e0b}.afk-junk-filters select[hidden]{display:none!important}.afk-trial-dialog-link{display:inline!important;margin:0 1px!important;padding:0 2px!important;border:0!important;border-bottom:1px dashed #a78bfa!important;border-radius:2px!important;background:rgba(76,29,149,.12)!important;color:#c4b5fd!important;font:inherit!important;font-weight:900!important;line-height:inherit!important;vertical-align:baseline!important;cursor:pointer!important}.afk-trial-dialog-link:hover,.afk-trial-dialog-link:focus-visible{background:#4c1d95!important;color:#f5f3ff!important;outline:1px solid #8b5cf6!important}' +
        '.afk-wf-groups{display:flex;flex-direction:column;gap:6px}' +
        '.afk-wf-group{border:1px solid #334155;border-radius:8px;overflow:hidden;background:rgba(15,23,42,.45)}' +
        '.afk-wf-group-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:0;background:#172033;color:#dbeafe;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;text-align:left}' +
        '.afk-wf-group-head:hover{background:#1e293b}' +
        '.afk-wf-group-meta{display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:10px;font-weight:600}' +
        '.afk-wf-group-body[hidden]{display:none!important}' +
        '.afk-wf-group-body{padding:3px 8px 5px}' +
        '.afk-wf-row{display:grid;grid-template-columns:minmax(88px,1fr) minmax(58px,76px) 50px 38px;align-items:center;gap:5px;padding:6px 0;border-bottom:1px solid rgba(51,65,85,.55)}' +
        '.afk-wf-row:last-child{border-bottom:0}' +
        '.afk-wf-label{min-width:0;color:#cbd5e1;font-size:11px;white-space:nowrap}' +
        '.afk-wf-row input[type="range"]{width:100%;height:4px;accent-color:#10b981;cursor:pointer}' +
        '.afk-wf-row input[type="number"]{width:50px;box-sizing:border-box;padding:3px 2px;background:#0f172a;border:1px solid #475569;border-radius:5px;color:#fff;font-family:inherit;font-size:11px;text-align:center}' +
        '.afk-wf-value{width:38px;color:#34d399;font-size:10px;font-weight:800;text-align:right}' +
        'body.m-mobile .afk-wf-row{grid-template-columns:minmax(82px,1fr) minmax(48px,64px) 48px 36px;gap:4px}' +
        '.afk-card-tier-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;width:100%;margin-top:4px}' +
        '.afk-card-tier-btn{min-width:0;padding:3px 0;border:1px solid #475569;border-radius:4px;background:#1e293b;color:#94a3b8;font-family:inherit;font-size:10px;font-weight:800;line-height:1.2;cursor:pointer;transition:background .15s,color .15s,border-color .15s,box-shadow .15s}' +
        '.afk-card-tier-btn:hover{filter:brightness(1.25)}' +
        '.afk-card-tier-0.active{background:#334155;color:#f1f5f9;border-color:#94a3b8;box-shadow:0 0 0 1px rgba(148,163,184,.2)}' +
        '.afk-card-tier-1.active{background:#475569;color:#f8fafc;border-color:#cbd5e1;box-shadow:0 0 0 1px rgba(203,213,225,.25)}' +
        '.afk-card-tier-2.active{background:#334155;color:#f8fafc;border-color:#e2e8f0;box-shadow:0 0 6px rgba(226,232,240,.45)}' +
        '.afk-card-tier-3.active{background:#78350f;color:#fde68a;border-color:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,.45)}' +
        'body.m-mobile .afk-card-tier-btn{padding:5px 0;font-size:11px}' +
        '.afk-inv-selected{position:relative!important;outline:2px solid #22d3ee!important;outline-offset:-2px;background:linear-gradient(90deg,rgba(8,145,178,.3),rgba(30,41,59,.96))!important}.afk-inv-selected:after{content:"✓";position:absolute;right:7px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#0891b2;color:#ecfeff;font:900 12px system-ui;box-shadow:0 2px 6px rgba(0,0,0,.4)}' +
        '.afk-inv-batchbar{position:sticky;top:calc(var(--afk-quick-header-height,42px) + var(--afk-filter-height,42px));z-index:11;display:flex;align-items:center;gap:5px;padding:6px;border:1px solid #0e7490;border-radius:8px;background:rgba(8,47,73,.97);box-shadow:0 6px 16px rgba(0,0,0,.3)}.afk-inv-batchbar[hidden]{display:none!important}.afk-inv-batchbar:before{content:"已選 " attr(data-count) " 件";margin-right:auto;color:#a5f3fc;font:900 10px system-ui}.afk-inv-batchbar button{padding:5px 8px;border:1px solid #0891b2;border-radius:6px;background:#164e63;color:#cffafe;font:800 10px system-ui;cursor:pointer}.afk-inv-batchbar button.clear{border-color:#64748b;background:#334155;color:#e2e8f0}' +
        '#afk-castle-toggle,#afk-pledge-toggle{flex:none;padding:4px 8px;border:1px solid #b89243;border-radius:7px;background:#3a2f12;color:#fde68a;font:800 10px/1.2 system-ui;cursor:pointer;white-space:nowrap}#afk-pledge-toggle{border-color:#0f766e;background:#134e4a;color:#ccfbf1}.afk-system-choice{box-sizing:border-box;max-width:640px;margin:10px auto;padding:16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;border:1px solid #475569;border-radius:12px;background:rgba(15,23,42,.9);color:#e2e8f0}.afk-system-choice h3,.afk-system-choice p{grid-column:1/-1;margin:0;color:#fde68a}.afk-system-choice button{padding:14px;border:1px solid #0f766e;border-radius:9px;background:#115e59;color:#ccfbf1;font-weight:900;cursor:pointer}.afk-pandora-highlight{animation:afkPandoraPulse .65s ease-in-out 3}@keyframes afkPandoraPulse{50%{border-color:#facc15;box-shadow:0 0 18px rgba(250,204,21,.8)}}' +
        '#classic-badge,#traditional-badge{display:none!important}#afk-mode-chip{display:inline-flex;align-items:center;gap:4px;margin-left:5px;padding:3px 8px;border:1px solid #64748b;border-radius:999px;background:#1e293b;color:#e2e8f0;font:900 10px/1.2 system-ui;cursor:pointer;white-space:nowrap}#afk-mode-chip[data-mode="classic"]{border-color:#d97706;background:#3a2f12;color:#fbbf24}#afk-mode-chip[data-mode="traditional"]{border-color:#7c3aed;background:#2e1065;color:#ddd6fe}#afk-mode-chip[data-mode="classic_traditional"]{border-color:#0d9488;background:#134e4a;color:#99f6e4}' +
        '#afk-mode-overlay{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:12px;background:rgba(2,6,23,.72);font-family:system-ui,sans-serif}.afk-mode-dialog{box-sizing:border-box;width:min(560px,100%);max-height:calc(100vh - 24px);overflow:auto;padding:13px;border:1px solid #475569;border-radius:13px;background:#0f172a;color:#e2e8f0;box-shadow:0 22px 70px rgba(0,0,0,.8)}.afk-mode-dialog header{display:flex;align-items:center;justify-content:space-between;padding-bottom:9px;border-bottom:1px solid #334155}.afk-mode-dialog header>div{display:flex;flex-direction:column}.afk-mode-dialog header strong{color:#67e8f9}.afk-mode-dialog header small{color:#94a3b8;font-size:9px}.afk-mode-dialog header button{width:28px;height:28px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#e2e8f0;font-size:18px;cursor:pointer}.afk-mode-dialog h3{margin:12px 0 6px;color:#cbd5e1;font-size:12px}.afk-mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.afk-mode-grid button,.afk-mode-slot{padding:9px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#e2e8f0;font-weight:800;cursor:pointer}.afk-mode-grid button.active{border-color:#22d3ee;background:#164e63;color:#cffafe}.afk-mode-slot-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.afk-mode-slot-head select{padding:6px;border:1px solid #475569;border-radius:7px;background:#111827;color:#e2e8f0}.afk-mode-slots{display:flex;flex-direction:column;gap:5px}.afk-mode-slot{text-align:left}.afk-mode-slot:hover{border-color:#22d3ee}.afk-mode-empty{padding:14px;color:#94a3b8;text-align:center}' +
        '.afk-material-route.shop:hover{border-color:#22c55e;background:#052e16}.afk-material-route.market:hover{border-color:#c084fc;background:#2e1065}' +
        '#afk-rv:hover{filter:brightness(1.2)}';
        (document.head || document.documentElement).appendChild(s);
    })();

})();

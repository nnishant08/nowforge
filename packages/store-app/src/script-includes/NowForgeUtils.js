// Script Include: NowForgeUtils
// Application: NowForge (x_nowfg_nowforge)
// Client callable: false
//
// Shared utility functions used by the quality scanner, doc generator,
// instance manager, and governance logger.

var NowForgeUtils = Class.create();
NowForgeUtils.prototype = {
    initialize: function () {},

    /** Return the line number (1-indexed) of a 0-indexed character position. */
    lineNumberAt: function (text, charIndex) {
        var slice = text.substring(0, charIndex);
        return slice.split('\n').length;
    },

    /** Score → letter grade (matches the browser-side scanner). */
    gradeFor: function (score) {
        if (score >= 90) return 'A';
        if (score >= 75) return 'B';
        if (score >= 60) return 'C';
        if (score >= 40) return 'D';
        return 'F';
    },

    /** Comma-separated property → array. */
    propAsList: function (propName, defaultValue) {
        var raw = gs.getProperty(propName, defaultValue || '');
        if (!raw) return [];
        return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    },

    /** Get the sys_id for a scope name (e.g. "x_nowfg_nowforge"). */
    scopeIdFor: function (scopeName) {
        var gr = new GlideRecord('sys_scope');
        if (gr.get('scope', scopeName)) return gr.getUniqueValue();
        return '';
    },

    /** Pretty time delta in human form: "2 hours ago", "yesterday". */
    timeAgo: function (gdt) {
        if (!gdt) return '';
        var now = new GlideDateTime();
        var diff = now.getNumericValue() - gdt.getNumericValue();
        var min = 60 * 1000, hr = 60 * min, day = 24 * hr;
        if (diff < min) return 'just now';
        if (diff < hr) return Math.floor(diff / min) + ' min ago';
        if (diff < day) return Math.floor(diff / hr) + ' hr ago';
        if (diff < 2 * day) return 'yesterday';
        return Math.floor(diff / day) + ' days ago';
    },

    type: 'NowForgeUtils'
};

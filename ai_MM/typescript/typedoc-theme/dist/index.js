/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var src_exports = {};
__export(src_exports, {
  MediaMonkeyTheme: () => MediaMonkeyTheme,
  MediaMonkeyThemeRenderContext: () => MediaMonkeyThemeRenderContext,
  load: () => load
});
module.exports = __toCommonJS(src_exports);
var import_typedoc = require("typedoc");
const selectedNavigationLink = "Develop";
class MediaMonkeyThemeRenderContext extends import_typedoc.DefaultThemeRenderContext {
  constructor(theme, page, options) {
    super(theme, page, options);
    this.footer = () => {
      return /* @__PURE__ */ import_typedoc.JSX.createElement(import_typedoc.JSX.Fragment, null, /* @__PURE__ */ import_typedoc.JSX.createElement("div", { class: "container footer" }, /* @__PURE__ */ import_typedoc.JSX.createElement("p", null, /* @__PURE__ */ import_typedoc.JSX.createElement("span", { class: "left" }, /* @__PURE__ */ import_typedoc.JSX.createElement("a", { href: "https://www.ventismedia.com/", class: "copyright" }, "\xA9 2000-", (/* @__PURE__ */ new Date()).getFullYear(), " Ventis Media Inc.")), /* @__PURE__ */ import_typedoc.JSX.createElement("span", { class: "right" }, "Generated using ", /* @__PURE__ */ import_typedoc.JSX.createElement("a", { href: "https://typedoc.org/", target: "_blank", class: "highlight" }, "TypeDoc")))));
    };
    let originalPageSidebar = this.pageSidebar;
    this.pageSidebar = (props) => {
      let originalSidebarContent = originalPageSidebar(props);
      return /* @__PURE__ */ import_typedoc.JSX.createElement(import_typedoc.JSX.Fragment, null, /* @__PURE__ */ import_typedoc.JSX.createElement("div", { class: "navbar-nav" }, Object.entries(this.options.getValue("navigationLinks")).map(([label, url]) => /* @__PURE__ */ import_typedoc.JSX.createElement("div", { class: "nav-item" }, /* @__PURE__ */ import_typedoc.JSX.createElement(
        "a",
        {
          class: selectedNavigationLink == label ? "highlight" : "",
          href: url
        },
        label
      )))), originalSidebarContent);
    };
    this.toolbar = (props) => /* @__PURE__ */ import_typedoc.JSX.createElement(import_typedoc.JSX.Fragment, null, /* @__PURE__ */ import_typedoc.JSX.createElement("header", { class: "tsd-page-toolbar" }, /* @__PURE__ */ import_typedoc.JSX.createElement("div", { class: "tsd-toolbar-contents container" }, /* @__PURE__ */ import_typedoc.JSX.createElement("div", { class: "table-cell", id: "tsd-search", "data-base": this.relativeURL("./") }, /* @__PURE__ */ import_typedoc.JSX.createElement("a", { href: this.options.getValue("titleLink") ?? this.relativeURL("index.html"), class: "title" }, "MediaMonkey"), /* @__PURE__ */ import_typedoc.JSX.createElement("div", { class: "field" }, /* @__PURE__ */ import_typedoc.JSX.createElement("label", { for: "tsd-search-field", class: "tsd-widget tsd-toolbar-icon search no-caption" }, this.icons.search()), /* @__PURE__ */ import_typedoc.JSX.createElement("input", { type: "text", id: "tsd-search-field", "aria-label": "Search" })), /* @__PURE__ */ import_typedoc.JSX.createElement("div", { class: "field" }, /* @__PURE__ */ import_typedoc.JSX.createElement("div", { id: "tsd-toolbar-links", class: "navbar-nav" }, Object.entries(this.options.getValue("navigationLinks")).map(([label, url]) => /* @__PURE__ */ import_typedoc.JSX.createElement(
      "a",
      {
        class: selectedNavigationLink == label ? "highlight" : "",
        href: url
      },
      label
    )))), /* @__PURE__ */ import_typedoc.JSX.createElement("ul", { class: "results" }, /* @__PURE__ */ import_typedoc.JSX.createElement("li", { class: "state loading" }, "Preparing search index..."), /* @__PURE__ */ import_typedoc.JSX.createElement("li", { class: "state failure" }, "The search index is not available"))), /* @__PURE__ */ import_typedoc.JSX.createElement("div", { class: "table-cell", id: "tsd-widgets" }, /* @__PURE__ */ import_typedoc.JSX.createElement("a", { href: "#", class: "tsd-widget tsd-toolbar-icon menu no-caption", "data-toggle": "menu", "aria-label": "Menu" }, this.icons.menu())))));
  }
}
class MediaMonkeyTheme extends import_typedoc.DefaultTheme {
  getRenderContext(pageEvent) {
    this._contextCache || (this._contextCache = new MediaMonkeyThemeRenderContext(
      this,
      pageEvent,
      this.application.options
    ));
    return this._contextCache;
  }
  render(page, template) {
    return super.render(page, template);
  }
}
function load(app) {
  app.renderer.hooks.on(
    "head.end",
    (context) => /* @__PURE__ */ import_typedoc.JSX.createElement(import_typedoc.JSX.Fragment, null, /* @__PURE__ */ import_typedoc.JSX.createElement("link", { rel: "stylesheet", href: context.relativeURL("assets/test.css") }), /* @__PURE__ */ import_typedoc.JSX.createElement("link", { rel: "preload", as: "style", href: "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,700;1,400;1,700&display=swap" }), /* @__PURE__ */ import_typedoc.JSX.createElement("link", { rel: "shortcut icon", href: "https://www.mediamonkey.com/favicon.ico" }))
  );
  app.renderer.hooks.on("body.begin", (_) => /* @__PURE__ */ import_typedoc.JSX.createElement("script", null, /* @__PURE__ */ import_typedoc.JSX.createElement(import_typedoc.JSX.Raw, { html: "console.log(`Loaded ${location.href}`)" })));
  app.renderer.defineTheme("mediamonkey", MediaMonkeyTheme);
  const GEP = app.getEntryPoints;
  app.getEntryPoints = () => {
    const entryPoints = GEP.bind(app)();
    if (entryPoints) {
      for (let entryPoint of entryPoints) {
        if (entryPoint.displayName.includes("/")) {
          let split = entryPoint.displayName.split("/");
          entryPoint.displayName = split[split.length - 1];
        }
      }
    }
    return entryPoints;
  };
  const unimportantTag = new import_typedoc.CommentTag("@undocumented", []);
  const allowedUnimportantKindsMask = import_typedoc.ReflectionKind.Class | import_typedoc.ReflectionKind.Function | import_typedoc.ReflectionKind.Method | import_typedoc.ReflectionKind.Variable | import_typedoc.ReflectionKind.Property | import_typedoc.ReflectionKind.Interface;
  app.converter.on("createDeclaration", (ctx, declaration) => {
    if (!declaration.comment && allowedUnimportantKindsMask & declaration.kind) {
      declaration.comment = new import_typedoc.Comment([], [unimportantTag.clone()]);
    }
  });
  app.on(import_typedoc.Application.EVENT_BOOTSTRAP_END, () => {
    const tags = [...app.options.getValue("inlineTags")];
    if (!tags.includes("@displayType")) {
      tags.push("@displayType");
    }
    if (!tags.includes("@removeType")) {
      tags.push("@removeType");
    }
    if (!tags.includes("@removeTypeParameterCompletely")) {
      tags.push("@removeTypeParameterCompletely");
    }
    app.options.setValue("inlineTags", tags);
  });
  app.converter.on(
    import_typedoc.Converter.EVENT_RESOLVE,
    (context, reflection) => {
      if (!reflection.comment)
        return;
      const index = reflection.comment.summary.findIndex(
        (part2) => part2.kind === "inline-tag" && ["@displayType", "@removeType", "@removeTypeParameterCompletely"].includes(part2.tag)
      );
      if (index === -1)
        return;
      const removed = reflection.comment.summary.splice(index, 1);
      const part = removed[0];
      reflection.type?.visit(
        (0, import_typedoc.makeRecursiveVisitor)({
          reflection(r) {
            context.project.removeReflection(r.declaration);
          }
        })
      );
      if (part.tag === "@removeType") {
        delete reflection.type;
        if ("default" in reflection)
          delete reflection.default;
      } else if (part.tag === "@removeTypeParameterCompletely") {
        context.project.removeReflection(reflection);
      } else {
        reflection.type = new import_typedoc.UnknownType(
          part.text.replace(/^`*|`*$/g, "")
        );
      }
    }
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MediaMonkeyTheme,
  MediaMonkeyThemeRenderContext,
  load
});

import {
    Application,
    JSX,
    DefaultTheme,
    PageEvent,
    Reflection,
    DefaultThemeRenderContext,
    Options,
    EntryPointStrategy,
    Context,
    DeclarationReflection,
    Comment,
    CommentTag,
    ReflectionKind,
    RenderTemplate,
    Converter,
    TypeParameterReflection,
    ParameterReflection,
    SignatureReflection,
    makeRecursiveVisitor,
    InlineTagDisplayPart,
    UnknownType
} from 'typedoc';

const selectedNavigationLink = 'Develop';
	
export class MediaMonkeyThemeRenderContext extends DefaultThemeRenderContext {
    constructor(theme: DefaultTheme, page: PageEvent<Reflection>, options: Options) {
        super(theme, page, options);
	
        // Overridden methods must have `this` bound if they intend to use it.
        // <JSX.Raw /> may be used to inject HTML directly.
        this.footer = () => {
            return (
                <>
                    <div class="container footer">
                        <p>
                            <span class="left">
                                <a href="https://www.ventismedia.com/" class="copyright">
								© 2000-{new Date().getFullYear()} Ventis Media Inc.
                                </a>
                            </span>
                            <span class="right">
							
                                {'Generated using '}
                                <a href="https://typedoc.org/" target="_blank" class="highlight">
								TypeDoc
                                </a>
                            </span>
                        </p>
                    </div>
                </>
            );
        };
		
        // Insert our MM website links into the sidebar
        let originalPageSidebar = this.pageSidebar;
        
        this.pageSidebar = (props) => {
            let originalSidebarContent = originalPageSidebar(props);
            return <>
                <div class="navbar-nav">
                    {Object.entries(this.options.getValue('navigationLinks')).map(([label, url]) => (
                        <div class="nav-item">
                            <a 
                                class={selectedNavigationLink == label ? 'highlight' : ''}
                                href={url}
                            >
                                {label}
                            </a>
                        </div>
                    ))}
                </div>
                {originalSidebarContent}
            </>;
        };
        
        this.toolbar = (props) => <>
            <header class="tsd-page-toolbar">
                <div class="tsd-toolbar-contents container">
                    <div class="table-cell" id="tsd-search" data-base={this.relativeURL('./')}>
	
                        <a href={this.options.getValue('titleLink') ?? this.relativeURL('index.html')} class="title">
							MediaMonkey
                        </a>
						
                        <div class="field">
                            <label for="tsd-search-field" class="tsd-widget tsd-toolbar-icon search no-caption">
                                {this.icons.search()}
                            </label>
                            <input type="text" id="tsd-search-field" aria-label="Search" />
                        </div>
	
                        <div class="field">
                            <div id="tsd-toolbar-links" class="navbar-nav">
                                {Object.entries(this.options.getValue('navigationLinks')).map(([label, url]) => (
                                    <a 
                                        class={selectedNavigationLink == label ? 'highlight' : ''} 
                                        href={url}
                                    >
                                        {label}
                                    </a>
                                ))}
                            </div>
                        </div>
	
                        <ul class="results">
                            <li class="state loading">Preparing search index...</li>
                            <li class="state failure">The search index is not available</li>
                        </ul>
                    </div>
	
                    <div class="table-cell" id="tsd-widgets">
                        <a href="#" class="tsd-widget tsd-toolbar-icon menu no-caption" data-toggle="menu" aria-label="Menu">
                            {this.icons.menu()}
                        </a>
                    </div>
                </div>
            </header>
        </>;
    }
}
	
export class MediaMonkeyTheme extends DefaultTheme {
    private _contextCache?: MediaMonkeyThemeRenderContext;
	
    override getRenderContext(pageEvent: PageEvent<Reflection>): MediaMonkeyThemeRenderContext {
        this._contextCache ||= new MediaMonkeyThemeRenderContext(
            this,
            pageEvent,
            this.application.options
        );
        return this._contextCache;
    }
    render(page: PageEvent<Reflection>, template: RenderTemplate<PageEvent<Reflection>>): string {
        // this.application.logger.info(`Rendering ${page.url}`);
        return super.render(page, template);
    }
}
	
/**
 * Called by TypeDoc when loading this theme as a plugin. Should be used to define themes which
 * can be selected by the user.
*/
export function load(app: Application) {
	
    app.renderer.hooks.on(
        'head.end',
        (context): JSX.Element => (
            <>
                <link rel='stylesheet' href={context.relativeURL('assets/test.css')} />
                <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,700;1,400;1,700&amp;display=swap"/>
                <link rel="shortcut icon" href="https://www.mediamonkey.com/favicon.ico"/>
            </>
        ),
    );	
    // Hooks can be used to inject some HTML without fully overwriting the theme.
    app.renderer.hooks.on('body.begin', (_) => (
        <script>
            <JSX.Raw html="console.log(`Loaded ${location.href}`)" />
        </script>
    ));
	
    app.renderer.defineTheme('mediamonkey', MediaMonkeyTheme);
    
    const GEP = app.getEntryPoints;
    app.getEntryPoints = () => {
        // Get the original entry points
        const entryPoints = GEP.bind(app)();
        // Remove the file path from the entry points
        if (entryPoints) {
            for (let entryPoint of entryPoints) {
                if (entryPoint.displayName.includes('/')) {
                    let split = entryPoint.displayName.split('/');
                    entryPoint.displayName = split[split.length - 1];
                }
            }
        }
        return entryPoints;
    };
    const unimportantTag = new CommentTag('@undocumented', []);
    
    // ReflectionKind appears to be a boolean mask, probably for super quick filtering.
    // I don't want ALL types of declarations to be marke as undocumented if they don't have comments,
    // so we can filter based on our own mask
    const allowedUnimportantKindsMask = ReflectionKind.Class | ReflectionKind.Function | 
        ReflectionKind.Method | ReflectionKind.Variable | ReflectionKind.Property |
        ReflectionKind.Interface;
    
    app.converter.on('createDeclaration', (ctx: Context, declaration: DeclarationReflection) => {
        // If the declaration passes the "allowed" mask and it has no comment, mark it as unimportant
        if (!declaration.comment && (allowedUnimportantKindsMask & declaration.kind)) {
            declaration.comment = new Comment([], [unimportantTag.clone()]);
        }
    });
    
    // https://github.com/TypeStrong/typedoc/issues/2273#issuecomment-1537164006
    app.on(Application.EVENT_BOOTSTRAP_END, () => {
        const tags = [...app.options.getValue('inlineTags')];
        if (!tags.includes('@displayType')) {
            tags.push('@displayType');
        }
        if (!tags.includes('@removeType')) {
            tags.push('@removeType');
        }
        if (!tags.includes('@removeTypeParameterCompletely')) {
            tags.push('@removeTypeParameterCompletely');
        }
        app.options.setValue('inlineTags', tags);
    });
    
    app.converter.on(
        Converter.EVENT_RESOLVE,
        (context: Context, reflection: DeclarationReflection|TypeParameterReflection|ParameterReflection|SignatureReflection) => {
            if (!reflection.comment) return;

            const index = reflection.comment.summary.findIndex(
                (part) =>
                    part.kind === 'inline-tag' &&
                    ['@displayType', '@removeType', '@removeTypeParameterCompletely'].includes(part.tag)
            );

            if (index === -1) return;

            const removed = reflection.comment.summary.splice(index, 1);
            const part = (removed[0]) as InlineTagDisplayPart;

            // Clean up the existing type so that the project can be serialized/deserialized without warnings
            reflection.type?.visit(
                makeRecursiveVisitor({
                    reflection(r) {
                        context.project.removeReflection(r.declaration);
                    },
                })
            );

            // @removeType removes the type/default of the type parameter/generic 
            if (part.tag === '@removeType') {
                // reflection.type is given by "extends", reflection.default is given by "="
                delete reflection.type;
                if ('default' in reflection)
                    delete reflection.default;
            }
            // @removeTypeParameterCompletely removes the type parameter completely
            else if (part.tag === '@removeTypeParameterCompletely') {
                context.project.removeReflection(reflection);
            }
            else {
                // @displayType
                reflection.type = new UnknownType(
                    part.text.replace(/^`*|`*$/g, '')
                );
            }
        }
    );
}
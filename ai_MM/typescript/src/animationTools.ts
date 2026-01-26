'use strict';
/**
 * Object with helper methods for animations. Accessible via the global `animTools`.
 *
 * @packageDocumentation
 * @static
 */

let easings = [ // To be used for Web animations
    ['ease', [0.25, 0.1, 0.25, 1.0]],
    ['ease-in', [0.42, 0.0, 1.00, 1.0]],
    ['ease-out', [0.00, 0.0, 0.58, 1.0]],
    ['ease-in-out', [0.42, 0.0, 0.58, 1.0]],
    ['easeInSine', [0.47, 0, 0.745, 0.715]],
    ['easeOutSine', [0.39, 0.575, 0.565, 1]],
    ['easeInOutSine', [0.445, 0.05, 0.55, 0.95]],
    ['easeInQuad', [0.55, 0.085, 0.68, 0.53]],
    ['easeOutQuad', [0.25, 0.46, 0.45, 0.94]],
    ['easeInOutQuad', [0.455, 0.03, 0.515, 0.955]],
    ['easeInCubic', [0.55, 0.055, 0.675, 0.19]],
    ['easeOutCubic', [0.215, 0.61, 0.355, 1]],
    ['easeInOutCubic', [0.645, 0.045, 0.355, 1]],
    ['easeInQuart', [0.895, 0.03, 0.685, 0.22]],
    ['easeOutQuart', [0.165, 0.84, 0.44, 1]],
    ['easeInOutQuart', [0.77, 0, 0.175, 1]],
    ['easeInQuint', [0.755, 0.05, 0.855, 0.06]],
    ['easeOutQuint', [0.23, 1, 0.32, 1]],
    ['easeInOutQuint', [0.86, 0, 0.07, 1]],
    ['easeInExpo', [0.95, 0.05, 0.795, 0.035]],
    ['easeOutExpo', [0.19, 1, 0.22, 1]],
    ['easeInOutExpo', [1, 0, 0, 1]],
    ['easeInCirc', [0.6, 0.04, 0.98, 0.335]],
    ['easeOutCirc', [0.075, 0.82, 0.165, 1]],
    ['easeInOutCirc', [0.785, 0.135, 0.15, 0.86]]];

let velocity = true;

function animate(element, props, options?) {
    if (!options)
        options = {};
    if (options.duration == undefined)
        options.duration = animTools.animationTime * 1000;
    options.easing = options.easing || animTools.defaultEasing; // JH: Looks usually better than the 'linear' default
    options.progress = function (p1, p2, p3, p4) {
        if (options.step)
            options.step(p1, p2, p3, p4);
    };
    let fn = options.complete;
    options.complete = function () {
        if (fn && isFunction(fn))
            fn();
        if (options.layoutchange !== false) {
            deferredNotifyLayoutChangeDown(element.parentElement || window);
        }
    };

    if (velocity) {
        Velocity(element, props, options);
        return;
    }

    let finished = false;

    let pr = props;
    props = [{}, props];

    let stepFunction = function () {
        if (!finished) {
            if (options.step)
                options.step();
            requestAnimationFrameMM(stepFunction);
        }
    };

    if (options.step)
        requestAnimationFrameMM(stepFunction);

    // Map properties for Web Animations usage
    for (let p in pr) {
        if (Array.isArray(pr[p])) {
            props[0][p] = pr[p][1];
            pr[p] = pr[p][0];
        } else {
            props[0][p] = getComputedStyle(element)[p]; // The current value (to start the animation with).
            if (typeof props[0][p] == 'string' && props[0][p].slice(-2) == 'px' && (typeof props[1][p] != 'string' || props[1][p].slice(-2) != 'px') && (props[1][p] != 'auto'))
                props[1][p] = props[1][p] + 'px'; // To unify usage of 'px'.
        }

        // Convert 'scale' to 'transform: scale()'
        if (p == 'scale') {
            props[0]['transform'] = 'scale(' + props[0][p] + ')';
            props[1]['transform'] = 'scale(' + props[1][p] + ')';
        }
    }

    ODS('AAAAAAAAAnimation: ' + JSON.stringify(props));
    let animation = element.animate(props, {
        duration: options.duration,
        fill: 'forwards',
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)' //options.easing   // TO-DO:  Use the proper easing
    });
    element.currentAnimation = animation;

    animation.onfinish = function () {
        finished = true;
        ODS('AAAAAAAAAnimation End!!!!!!');
        element.currentAnimation = undefined;
        if (options.complete)
            options.complete();
    };
}

let ZI_BACK = 0;
let ZI_TOP = 1;


/**
Default animation time (seconds) for many transitions in the UI. Is automatically retrieved from skin_base.less '@animationTime' constant.

@property animationTime
@type float
*/
whenLoaded(function () {
    let ruleVal = getStyleRuleValue('transition-duration', '.animationTime');
    if (ruleVal !== undefined) {
        ODS('AnimationTime set to ' + ruleVal);
        animTools.animationTime = parseFloat(ruleVal);
    } else {
        ODS('AnimationTime rule not found');
        animTools.animationTime = 0.3; // some default
    }
    if (app.tests)
        animTools.animationTime = 0; // for screen tests its better/faster to not animate
});

let animTools = {

    animationTime: 0.3, // LS: to be assigned from 'transition-duration' CSS style rule above
    defaultEasing: 'easeOutQuint',
    defaultEasingCSS: 'cubic-bezier(0.23, 1, 0.32, 1)',

    easingFn: Velocity.Easings,

    stopAnimation: function (element) {
        if (velocity) {
            Velocity(element, 'stop');
            return;
        }
        ODS('Stop Animation.');
        if (element.currentAnimation && !element.currentAnimation.finished) {
            element.currentAnimation.cancel();
            element.currentAnimation = undefined;
        }
    },
    /**
    Changes visibility of given element without using animation.
       
    @method notAnimateVisibility
    @param {HTMLElement} element HTML element to animate
    @param {Boolean} visible Target visibility
    */
    notAnimateVisibility: function (element, visible) {
        let style = element.style;
        if (visible) {
            if (style.display === 'none') {
                let disp = element.savedDisplay;
                if (disp === undefined)
                    disp = ''; // default
                style.display = disp;
            }
            if (style.visibility === 'hidden') {
                style.visibility = ''; // default   
            }
        } else {
            if (element.hasAttribute('data-hidebyvisibility'))
                style.visibility = 'hidden';
            else
            if (style.display !== 'none') {
                element.savedDisplay = style.display;
                style.display = 'none';
            }
        }
    },
    /**
    Changes visibility of given element using animation.
       
    @method animateVisibility
    @param {HTMLElement} element HTML element to animate
    @param {Boolean} visible Target visibility
    @param {Object} [params]  Additional parameters. See {{#crossLink "Window/setVisibility:method"}}{{/crossLink}}
    */
    animateVisibility: function (element, visible, params) {
        if (element._ongoingAnimation !== undefined) {
            if (element._ongoingAnimation === visible) {
                return;
            } else {
                this.stopAnimation(element);
            }
        }
        let dontAnimate = params && (params.animate === false);
        let props = {};
        let animProps = [];
        animProps = this.getVisibilityAnimation(element, visible);
        if (!animProps || (animProps.length === 0)) {
            this.notAnimateVisibility(element, visible);
            if ((!params || (params.layoutchange === undefined) || params.layoutchange) && element.parentElement) {
                notifyLayoutChangeDown(element.parentElement);
            }
            if (params && params.onComplete)
                params.onComplete(element);
            return;
        }

        let style = getComputedStyle(element);

        if (visible) {
            animProps.forEach(function (prop) {
                if (dontAnimate) {
                    element.style[prop] = element['saved' + prop + '_inline'];
                } else {
                    props[prop] = element['saved' + prop];
                    if (props[prop] === undefined) {
                        // The element wasn't visible yet, we have to care about it
                        props[prop] = style[prop];
                        element.style[prop] = (prop === 'opacity') ? '0' : '0px';
                    }
                }
            });
            element.style.visibility = ''; // the default
            element.style.display = (element.savedDisplay ? element.savedDisplay : ''); // the default        
        } else {
            if (isVisible(element, false)) {
                let fgset = false;
                animProps.forEach(function (prop) {
                    if ((element._ongoingAnimation !== undefined) && (element._ongoingAnimationProps[prop] !== undefined)) {
                        element['saved' + prop] = element._ongoingAnimationProps[prop];
                    } else {
                        element['saved' + prop] = style[prop];
                        element['saved' + prop + '_inline'] = element.style[prop];
                    }
                    if (dontAnimate) {
                        element.style[prop] = (prop === 'opacity') ? '0' : '0px';
                    } else {
                        props[prop] = (prop === 'opacity') ? '0' : '0px';
                    }
                    if (!fgset && ((prop === 'width') || (prop === 'height'))) {
                        if (style.getPropertyValue('flex-grow') != '0') {
                            element.style[prop] = style.getPropertyValue(prop);
                        }
                        element.savedflexGrow_inline = element.style.flexGrow;
                        element.style.flexGrow = '0';
                        fgset = true;
                    }
                });
            }
        }
        if (dontAnimate) {
            this.notAnimateVisibility(element, visible);
            if (visible) {
                if (element.savedflexGrow_inline !== undefined)
                    element.style.flexGrow = element.savedflexGrow_inline;
            }
            element._ongoingAnimation = undefined;
            element._ongoingAnimationProps = undefined;
            if ((!params || (params.layoutchange === undefined) || params.layoutchange) && element.parentElement) {
                notifyLayoutChangeDown(element.parentElement);
            }
            if (params && params.onComplete)
                params.onComplete(element);
            return;
        }
        element._ongoingAnimation = visible;
        element._ongoingAnimationProps = props;
        let animparams = {
            complete: function () {
                if (!visible) {
                    if (element.hasAttribute('data-hidebyvisibility')) {
                        element.style.visibility = 'hidden';
                    } else {
                        if (element.style.display !== 'none') {
                            element.savedDisplay = element.style.display;
                            element.style.display = 'none';
                        }
                    }
                } else {
                    if (element.savedflexGrow_inline !== undefined)
                        element.style.flexGrow = element.savedflexGrow_inline;
                    if (element.style.opacity === '0')
                        element.style.removeProperty('opacity'); // remove inline opacity, so set default value for opacity

                    // recover all animated properties to saved inline defaults
                    for (let prop in element._ongoingAnimationProps) {
                        let pname = 'saved' + prop + '_inline';
                        if (element[pname] !== undefined)
                            element.style[prop] = element[pname];
                        else
                            element.style.removeProperty(prop);
                    }
                }
                element._ongoingAnimation = undefined;
                element._ongoingAnimationProps = undefined;
                if (params && params.onComplete)
                    params.onComplete(element);
            },
            step: function () {
                /* LS: commented out the code bellow as it was causing just layout trashing / performance issues
                       it was originally added by Jiri in SVN revision 25645 with note "added layout changes to animation progress"
                       but why?? By testing I haven't found a reason.
                if (this.layoutchange && element.parentElement) {
                    deferredNotifyLayoutChangeDown(element.parentElement); // LS: changed to deferred version due to #17572 (and to make animations smoother in overall)
                }
                */
            },
            layoutchange: !params || params.layoutchange,
            duration: undefined
        };
        if (params && params.duration)
            animparams.duration = params.duration;
        animate(element, props, animparams);
    },

    /**
    Get array of properties to animate for the given element during visibility change
    
    @method getVisibilityAnimation
    @param {HTMLElement} element HTML element to animate
    @param {Boolean} visible Target visibility
    @return {Array} Array of property names
    */
    getVisibilityAnimation: function (element, visible) {
        let parentNode = element.parentNode;
        let retval = [];
        let animateOpacity = false;

        let animateWidth = function () {
            retval.push('width');
            retval.push('minWidth');
            retval.push('marginLeft');
            retval.push('marginRight');
        };

        let animateHeight = function () {
            retval.push('height');
            retval.push('minHeight');
            retval.push('marginTop');
            retval.push('marginBottom');
        };

        if (element.hasAttribute('data-animate-height')) {
            animateHeight();
            animateOpacity = true;
        } else
        if (element.hasAttribute('data-animate-width')) {
            animateWidth();
            animateOpacity = true;
        } else
        if (element.classList.contains('hoverHeader') || element.classList.contains('toolbutton') || element.classList.contains('tooltip')) {
            retval.push('opacity');
        } else if (parentNode) {
            if (parentNode.classList.contains('flex')) {
                if (parentNode.classList.contains('row')) {
                    animateWidth();
                } else if (parentNode.classList.contains('column')) {
                    animateHeight();
                }
            } else if (parentNode.controlClass && parentNode.controlClass.constructor && (parentNode.controlClass.constructor.name === 'Scroller')) {
                animateHeight();
                animateOpacity = true; // looks better when hiding sub-views (e.g. playlist header)
            }
        }

        if (retval.length === 0 || animateOpacity)
            retval.push('opacity');
        return retval;
    },

    animateTabHeaderRemove: function (tab) {
        animate(tab, {
            width: 0,
            paddingLeft: 0,
            paddingRight: 0,
            borderLeft: 0,
            borderRight: 0
        }, {
            complete: function () {
                tab.remove();
            }
        });
    },

    animateAddRow: function (row: HTMLElement, onComplete?:callback) {
        let origMinHeight = row.style.minHeight;
        let origHeight = row.clientHeight;
        row.style.minHeight = '0';
        row.style.height = '0';

        animate(row, {
            height: origHeight
        }, {
            complete: function () {
                row.style.minHeight = origMinHeight;
                row.style.height = origHeight.toString();
                if (onComplete)
                    onComplete();
            }
        });
    },

    animateRemoveRow: function (row: HTMLElement, onComplete?:callback) {
        row.style.minHeight = '0';
        row.classList.add('noOverflow');
        animate(row, {
            height: 0
        }, {
            complete: function () {
                row.remove();
                if (onComplete)
                    onComplete();
            }
        });
    },

    animateShowRow: function (row: HTMLElement, onComplete?:callback) {
        setVisibility(row, true); // LS: needs to be before row.style.height = 0 below to get correct position in Scroller !!
        let origMinHeight = row.style.minHeight;
        let origHeight = row.clientHeight;
        row.style.minHeight = '0';
        row.style.height = '0';
        animate(row, {
            height: origHeight
        }, {
            complete: function () {
                row.style.minHeight = origMinHeight;
                row.style.height = origHeight.toString();
                if (onComplete)
                    onComplete();
            }
        });
    },

    animateHideRow: function (row, onComplete?:callback) {
        let origMinHeight = row.style.minHeight;
        let origHeight = row.clientHeight;
        row.style.minHeight = 0;
        row.classList.add('noOverflow');
        animate(row, {
            height: 0
        }, {
            complete: function () {
                setVisibility(row, false);
                row.style.minHeight = origMinHeight;
                row.style.height = origHeight;
                if (onComplete)
                    onComplete();
            }
        });
    },

    setZoomOrigin: function (panel, rect) {
        let panelAbsPos = panel.getBoundingClientRect();

        let centerX = (rect.left - panelAbsPos.left) + rect.width / 2;
        let decenterOffsetX = ((centerX - panelAbsPos.width / 2) / panelAbsPos.width) * rect.width;
        let X = centerX + decenterOffsetX; // if we would scale to 0px then the decenterOffsetX is ZERO px !

        let centerY = (rect.top - panelAbsPos.top) + rect.height / 2;
        let decenterOffsetY = ((centerY - panelAbsPos.height / 2) / panelAbsPos.height) * rect.height;
        let Y = centerY + decenterOffsetY; // if we would scale to 0px then the decenterOffsetY is ZERO px !

        let origin = X + 'px ' + Y + 'px';
        panel.style.WebkitTransformOrigin = origin;
    },

    animateViewComeIn: function (params) {
        let panel = params.panel;
        let rect = params.clickedRect;

        if (params.useZoom && rect) {
            panel.style.zIndex = ZI_TOP; // we are zooming in, be on top

            this.setZoomOrigin(panel, rect);
            let panelAbsPos = panel.getBoundingClientRect();
            let scaleFrom = rect.width / panelAbsPos.width;

            // LS: it can happen that if this code is in RAF then the frame becomes the first frame of our animation and is of the non-scaled value (original full size) 
            //     and only the subsequent frames (the next frame) are of the correct scaleFrom value
            //     therefore we need to use workaround like this:           
            setVisibility(panel, false);
            requestAnimationFrameMM(function () {
                setVisibility(panel, true);
            });

            animate(panel, {
                scale: [1, scaleFrom],
                opacity: [1, 0.5]
            }, {
                easing: 'easeInOutQuint',
                complete: params.onComplete
            });
        } else {
            if (!isVisible(panel)) {
                setVisibility(panel, true, params);
            } else if (params.onComplete) {
                params.onComplete();
            }
            panel.style.zIndex = ZI_BACK; // old view is zooming out, so we need to keep self behind it
        }
    },

    animateViewComeOut: function (params) {
        let panel = params.panel;

        if (params.useZoom && params.clickedRect) {
            panel.style.zIndex = ZI_TOP; // we are zooming out, be on top

            let rect = params.clickedRect;
            this.setZoomOrigin(panel, rect);
            let scaleTo = rect.width / panel.offsetWidth;

            animate(panel, {
                scale: [scaleTo, 1],
                opacity: [0.5, 1]
            }, {
                easing: 'easeInOutQuint',
                complete: function () {
                    params.onComplete();
                    // we are caching controls (so that they can be re-used next time)
                    // so we need to reset the animation data (transform origin, size, opacity) back:
                    animate(panel, {
                        scale: [1, scaleTo],
                        opacity: [1, 0.5]
                    }, {
                        duration: 0
                    });
                }
            });
        } else {
            panel.style.zIndex = ZI_BACK; // new we is zooming in, keep self behind it
            animate(panel, {
                opacity: [1, 1], // just to stay and wait until the new child zoom in
            }, {
                complete: params.onComplete
            });
        }
    },

    animateHeaderHeight: function (params) {
        let targetHeightHeader;
        let targetSizeImage;
        if (params.expand) {
            targetHeightHeader = getStyleRuleValue('height', '.biggerHeaderHeight') || '240px';
            targetSizeImage = getStyleRuleValue('height', '.biggerImageSize') || '220px';
        } else {
            targetHeightHeader = getStyleRuleValue('height', '.middleHeaderHeight') || '120px';
            targetSizeImage = getStyleRuleValue('height', '.middleImageSize') || '110px';
        }
        if (params.image) {
            animate(params.image, {
                height: targetSizeImage,
                width: targetSizeImage,
                minHeight: targetSizeImage,
                minWidth: targetSizeImage,
                maxHeight: targetSizeImage,
                maxWidth: targetSizeImage,
            });
        }
        animate(params.header, {
            height: targetHeightHeader
        }, {
            complete: function () {
                if (params.onComplete)
                    params.onComplete();
            }
        });
    },

    animateToastMessage: function (div, vis) {
        if (vis) {
            div.style.bottom = '-150px';
            div.style.opacity = '0';
            div.style.display = 'block';
            animate(div, {
                bottom: ['0px', 'spring'],
                opacity: '1'
            }, {
                complete: function () {}
            });
        } else {
            animate(div, {
                bottom: '-150px',
                opacity: '0',
                layoutchange: false
            }, {
                complete: function () {
                    div.style.display = 'none';
                }
            });
        }
    },

    animateMenuPanel: function (div, vis, final_opacity) {
        let position = div.controlClass.position;
        if (vis) {
            div.style.bottom = '';
            div.style.top = '';
            div.style.left = '';
            div.style.right = '';
            div.style.opacity = '0';
            div.style.display = 'block';
            let animInfo = {
                opacity: final_opacity
            };
            if (position == 'bottom') {
                div.style.bottom = '-' + div.offsetHeight + 'px';
                animInfo['bottom'] = ['0px'];
            } else if (position == 'top') {
                div.style.top = '-' + div.offsetHeight + 'px';
                animInfo['top'] = ['0px'];
            } else if (position == 'left') {
                div.style.left = '-' + div.offsetWidth + 'px';
                animInfo['left'] = ['0px'];
            } else if (position == 'right') {
                div.style.right = '-' + div.offsetWidth + 'px';
                animInfo['right'] = ['0px'];
            }
            animate(div, animInfo);
        } else {
            let animInfo = {
                opacity: 0
            };
            if (position == 'bottom') {
                animInfo['bottom'] = '-' + div.offsetHeight + 'px';
            } else if (position == 'top') {
                animInfo['top'] = '-' + div.offsetHeight + 'px';
            } else if (position == 'left') {
                animInfo['left'] = '-' + div.offsetWidth + 'px';
            } else if (position == 'right') {
                animInfo['right'] = '-' + div.offsetWidth + 'px';
            }
            animate(div, animInfo, {
                complete: function () {
                    div.style.display = 'none';
                }
            });
        }
    },

    /**
    Starts an animation.

    It's based on Velocity implementation, which offers better performance than jQuery does.

    @method animate
    @param {HTMLElement} element Element to animate
    @param {HTMLElement} props Properties to animate
    @param {Object} [options] Can contain several values.<br>
        <b>duration</b> - Duration of the animation (in ms). If missing, animationTime global variable is used.<br>
        <b>complete</b> - Callback function executed when the animation is completed.<br>
        <b>layoutchange</b> - If false, not calling layoutchange event during animation.
    */
    animate: function (element: HTMLElement, props, options?: AnyDict) {
        animate(element, props, options);
    }
};

// @ts-ignore
window.animTools = animTools;

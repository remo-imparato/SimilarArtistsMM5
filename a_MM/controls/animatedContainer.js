/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/animatedContainer');
import Control from './control';
/**
 * AnimatedContainer - control for animating long label in limited space. Label control has to raise change event after content change to work properly.
 */
export default class AnimatedContainer extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        // overflow need to be hidden so content animation makes sense
        this.container.style.overflow = 'hidden';
        this.container.classList.add('flex', 'row', 'left', 'no-cpu');
        assert((this.container.children.length === 1), 'AnimatedContainer supports only one animated label');
        this.mainLabel = this.container.children[0];
        this.localListen(this.mainLabel, 'change', this.refresh.bind(this));
        this.textDivider = document.createElement('label');
        this.textDivider.style.marginLeft = '1rem';
        this.textDivider.style.marginRight = '1rem';
        this.textDivider.innerText = '* * *';
        this.textDivider.style.display = 'none';
        this.container.appendChild(this.textDivider);
        this.labelCopy = document.createElement('label');
        this.labelCopy.style.display = 'none';
        this.container.appendChild(this.labelCopy);
        this.registerEventHandler('layoutchange', true);
        this.refresh();
    }
    handle_layoutchange(e) {
        if ((this._lastWidth !== this.container.offsetWidth) || (this._lastHeight !== this.container.offsetHeight)) {
            this.refresh();
        }
        super.handle_layoutchange(e);
    }
    _getContent() {
        let content = this.mainLabel.innerText;
        return content;
    }
    _startBounce(contentSize) {
        let containerSize = this.container.offsetWidth;
        let fulldiff = Math.round(contentSize - containerSize);
        if (fulldiff <= 0)
            return;
        let startDelay = 100;
        this.nextDirection = -1;
        let diff = 0;
        this.repainter = setInterval(() => {
            if (startDelay > 0) {
                startDelay--;
                return;
            }
            diff += this.nextDirection;
            if ((diff <= -fulldiff) || (diff >= 0)) {
                this.nextDirection = -this.nextDirection;
                startDelay = 100;
            }
            this.mainLabel.style.marginLeft = diff + 'px';
        }, 20);
    }
    _startMarquee(contentSize) {
        let containerSize = this.container.offsetWidth;
        if (Math.round(contentSize - containerSize) <= 0)
            return;
        let diff = 0;
        let startDelay = 80;
        this.repainter = setInterval(() => {
            if (startDelay > 0) {
                startDelay--;
                return;
            }
            diff--;
            if ((contentSize + this.textDividerSz) <= -diff) {
                diff = 0;
            }
            let item = this.mainLabel;
            if (this.direction === 'rtl')
                item.style.marginRight = diff + 'px';
            else
                item.style.marginLeft = diff + 'px';
        }, 20);
    }
    _stopMoving() {
        if (this.repainter) {
            clearInterval(this.repainter);
            let item = this.mainLabel;
            if (this.direction === 'rtl') {
                animTools.animate(item, {
                    marginRight: 0,
                    duration: 500,
                });
            }
            else {
                animTools.animate(item, {
                    marginLeft: 0,
                    duration: 500,
                });
            }
            this.repainter = undefined;
        }
    }
    refresh() {
        this._stopMoving();
        this._lastWidth = this.container.offsetWidth;
        this._lastHeight = this.container.offsetHeight;
        this.lastContent = this._getContent();
        this.direction = getTextDirection(this.lastContent);
        if (this.direction !== 'rtl') {
            this.container.classList.toggle('row', true);
            this.container.classList.toggle('rowreverse', false);
        }
        else {
            this.container.classList.toggle('row', false);
            this.container.classList.toggle('rowreverse', true);
        }
        let contentSize = getFullWidth(this.mainLabel, {
            rounded: true
        });
        let containerSize = this.container.offsetWidth;
        let diff = Math.round(contentSize - containerSize);
        if ((diff <= 0) || (this.direction === 'mix')) {
            setVisibilityFast(this.textDivider, false);
            setVisibilityFast(this.labelCopy, false);
        }
        else {
            setVisibilityFast(this.textDivider, true);
            this.textDividerSz = getFullWidth(this.textDivider, {
                rounded: true
            });
            this.labelCopy.innerHTML = this.mainLabel.innerHTML;
            setVisibilityFast(this.labelCopy, true);
        }
        if (this.direction === 'mix')
            this._startBounce(contentSize);
        else
            this._startMarquee(contentSize);
    }
}
registerClass(AnimatedContainer);

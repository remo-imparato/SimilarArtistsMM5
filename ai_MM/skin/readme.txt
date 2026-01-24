Skin/layout creation tips:

 - Make the HTML code as simple and clean as possible. Fewer divs are easier to style than many divs!
 - Don't use 'px' and 'em' units for dimensions directly, but rather @units0_9, @units1_1, ... constants instead. 'px' don't scale well and excessive usage of 'em' results in fractional dimensions, which can result in undesired rendering of some elements. We prefer integer positions/dimensions.
 - Whereever possible, don't use numeric dimensions at all (including @unitsX_Y constants), rather style using predefined classes from skin_layout.less file. Using class 'border' is easier to manage/modify than directly styling using properties like 'border: solid 1px;'
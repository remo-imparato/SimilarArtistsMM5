/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

var Presets = {};

Presets["Geiss - Oldskool Mellowstyle.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.5,
    fDecay: 0.98,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 6,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bWaveThick: 1,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 1.0,
    fWaveScale: 1.605,
    fWaveSmoothing: 0.558,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.87,
    fModWaveAlphaEnd: 1.2899,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 2.853,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.064,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.0,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.7,
    wave_g: 0.7,
    wave_b: 0.7,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.01,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.0,
    ib_size: 0.01,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 0.0,
    nMotionVectorsX: 12.0,
    nMotionVectorsY: 9.0,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.9,
    mv_r: 1.0,
    mv_g: 1.0,
    mv_b: 1.0,
    mv_a: 0.0,
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.3 * (0.60 * sin(0.633 * time) + 0.40 * sin(0.845 * time));
            wave_g = wave_g + 0.3 * (0.60 * sin(0.370 * time) + 0.40 * sin(0.656 * time));
            wave_b = wave_b + 0.3 * (0.60 * sin(0.740 * time) + 0.40 * sin(0.520 * time));
            zoom = zoom + 0.013 * (0.60 * sin(0.339 * time) + 0.40 * sin(0.276 * time));
            rot = rot + 0.030 * (0.60 * sin(0.381 * time) + 0.40 * sin(0.579 * time));
            decay = decay - 0.01 * equal(frame % 50, 0);
            zoom = zoom + (bass_att - 1) * 0.001;
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Che - Escape.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.0,
    fDecay: 0.95,
    fVideoEchoZoom: 1.000498,
    fVideoEchoAlpha: 0.5,
    nVideoEchoOrientation: 1,
    nWaveMode: 5,
    bAdditiveWaves: 0,
    bWaveDots: 1,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 1.000416,
    fWaveScale: 0.608285,
    fWaveSmoothing: 0.9,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 1.0,
    fModWaveAlphaEnd: 1.0,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.0,
    fZoomExponent: 1.000154,
    fShader: 0.0,
    zoom: 1.000223,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.0,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.5,
    wave_g: 0.5,
    wave_b: 0.5,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.15,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.0,
    ib_size: 0.05,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 1.0,
    nMotionVectorsX: 6.4,
    nMotionVectorsY: 14.400005,
    mv_dx: 0.0,
    mv_dy: -0.01,
    mv_l: 0.35,
    mv_r: 0.9,
    mv_g: 0.5,
    mv_b: 0.0,
    mv_a: 1.0,
    per_pixel_code: function (_) {
        with(_) {
            zone = below(sin(sin(49 * q7) * 14 * x - sin(36 * q7) * 14 * y), -.2);
            zoom = 1 + .33 * q8 * ifcond(zone, -.5 + .1 * sin(1.08 * q6), .5 + .1 * sin(.96 * q6));
            zoomexp = exp(sin(ifcond(zone, q6, -q6)));
            rot = q8 * .03 * sin(q6 + q7 + q7 * zone);
        }
    },
    per_frame_code: function (_) {
        with(_) {
            // timed sidon sensor
            // le = signal level; desired average value = 2
            le = 1.4 * bass_att + .1 * bass + .5 * treb;
            pulse = above(le, th);
            // pulsefreq = running average of interval between last 5 pulses
            pulsefreq = ifcond(equal(pulsefreq, 0), 2,
                ifcond(pulse, .8 * pulsefreq + .2 * (time - lastpulse), pulsefreq));
            lastpulse = ifcond(pulse, time, lastpulse);
            // bt = relative time; 0 = prev beat; 1 = expected beat
            bt = (time - lastbeat) / (.5 * beatfreq + .5 * pulsefreq);
            // hccp = handcicap for th driven by bt
            hccp = (.03 / (bt + .2)) + .5 * ifcond(band(above(bt, .8), below(bt, 1.2)),
                (pow(sin((bt - 1) * 7.854), 4) - 1), 0);
            beat = band(above(le, th + hccp), btblock);
            btblock = 1 - above(le, th + hccp);
            lastbeat = ifcond(beat, time, lastbeat);
            beatfreq = ifcond(equal(beatfreq, 0), 2,
                ifcond(beat, .8 * beatfreq + .2 * (time - lastbeat), beatfreq));
            // th = threshold
            th = ifcond(above(le, th), le + 114 / (le + 10) - 7.407,
                th + th * .07 / (th - 12) + below(th, 2.7) * .1 * (2.7 - th));
            th = ifcond(above(th, 6), 6, th);

            q8 = 30 / fps;
            ccl = ccl + beat;
            minorccl = minorccl + le * q8;
            q7 = ccl + .0002 * minorccl;
            q6 = 3.7 * ccl + .01 * minorccl;
            ob_size = .3 + .3 * sin(16 * ccl + .007 * minorccl);
            ib_a = .5 + .4 * sin(.01 * minorccl + ccl);
            wave_r = .7 + .3 * sin(.04 * ccl + .01 * minorccl);
            wave_g = .7 + .3 * sin(.02 * ccl + .012 * minorccl);
            wave_b = .3 + .3 * sin(36 * ccl + .013 * minorccl);
            ib_r = .25 + .25 * sin(72 * ccl + .016 * minorccl);
            ib_g = .25 + .25 * sin(48 * ccl + .021 * minorccl);
            ib_b = .5 + .3 * sin(86 * ccl) + .2 * (.028 * minorccl);

            echo_alpha = .5 + .5 * cos(68 * ccl + .0041 * minorccl);
            echo_zoom = exp(sin(13.7 * ccl + .017 * minorccl));
            echo_orient = ccl % 4;

            mvrot = ccl % 6;
            mv_r = ifcond(above(mvrot, 2), ifcond(above(mvrot, 4), .039,
                ifcond(equal(mvrot, 3), .137, .835)), ifcond(above(mvrot, 1), .651,
                ifcond(equal(mvrot, 0), 1, .773)));
            mv_g = ifcond(above(mvrot, 2), ifcond(above(mvrot, 4), .267,
                ifcond(equal(mvrot, 3), .886, .176)), ifcond(above(mvrot, 1), .804,
                ifcond(equal(mvrot, 0), 1, .38)));
            mv_b = ifcond(above(mvrot, 2), ifcond(above(mvrot, 4), .694,
                ifcond(equal(mvrot, 3), .776, .851)), ifcond(above(mvrot, 1), .114,
                ifcond(equal(mvrot, 0), 1, .145)));
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Che - Terracarbon Stream.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.0,
    fDecay: 1.0,
    fVideoEchoZoom: 1.000499,
    fVideoEchoAlpha: 0.5,
    nVideoEchoOrientation: 1,
    nWaveMode: 3,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 0.03074,
    fWaveScale: 0.498516,
    fWaveSmoothing: 0.0,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 1.0,
    fModWaveAlphaEnd: 1.0,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.0,
    fZoomExponent: 1.000158,
    fShader: 0.0,
    zoom: 1.000223,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.0,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.0,
    wave_g: 0.5,
    wave_b: 0.5,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.1,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.06,
    ib_size: 0.035,
    ib_r: 0.25,
    ib_g: 0.45,
    ib_b: 0.25,
    ib_a: 0.29,
    nMotionVectorsX: 19.199999,
    nMotionVectorsY: 14.400005,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 2.5,
    mv_r: 0.06,
    mv_g: 1.0,
    mv_b: 1.0,
    mv_a: 0.2,
    per_pixel_code: function (_) {
        with(_) {
            dqv = above(x, .5) - above(y, .5);
            rot = sin(sin(rad * (13 + 5 * sin(.01 * q2)) + .06 * q2) * q1 * .01);
            zoom = 1 + ifcond(q3, dqv, 1) * .1 * sin(7 * ang + .03 * q2);
            zoom = ifcond(q4, ifcond(below(rad, .8 * sqr(sin(.016 * q2))), .75 + .4 * cos(.021 * q2), zoom), zoom);
        }
    },
    init_code: function (_) {
        with(_) {
            dle = 1;
        }
    },
    per_frame_code: function (_) {
        with(_) {
            // timed sidon sensor
            // le = signal level; desired average value = 2
            le = 1.4 * bass_att + .1 * bass + .5 * treb;
            pulse = above(le, th);
            // pulsefreq = running average of interval between last 5 pulses
            pulsefreq = ifcond(equal(pulsefreq, 0), 2,
                ifcond(pulse, .8 * pulsefreq + .2 * (time - lastpulse), pulsefreq));
            lastpulse = ifcond(pulse, time, lastpulse);
            // bt = relative time; 0 = prev beat; 1 = expected beat
            bt = (time - lastbeat) / (.5 * beatfreq + .5 * pulsefreq);
            // hccp = handcicap for th driven by bt
            hccp = (.03 / (bt + .2)) + .5 * ifcond(band(above(bt, .8), below(bt, 1.2)),
                (pow(sin((bt - 1) * 7.854), 4) - 1), 0);
            beat = band(above(le, th + hccp), btblock);
            btblock = 1 - above(le, th + hccp);
            lastbeat = ifcond(beat, time, lastbeat);
            beatfreq = ifcond(equal(beatfreq, 0), 2,
                ifcond(beat, .8 * beatfreq + .2 * (time - lastbeat), beatfreq));
            // th = threshold
            th = ifcond(above(le, th), le + 114 / (le + 10) - 7.407,
                th + th * .07 / (th - 12) + below(th, 2.7) * .1 * (2.7 - th));
            th = ifcond(above(th, 6), 6, th);
            thccl = thccl + (th - 2.5144);

            q1 = le;
            q2 = thccl + .2 * leccl;
            leccl = leccl + dle * le;
            dle = ifcond(beat, -dle, dle);
            bccl = bccl + beat;

            wave_r = .1 + .8 * sqr(sin(.011 * thccl)) + .1 * sin(leccl * .061);
            wave_g = .1 + .8 * sqr(sin(.013 * thccl)) + .1 * cos(leccl * .067);
            wave_b = .1 + .8 * sqr(cos(.017 * thccl)) + .1 * sin(leccl * .065);

            ib_r = ib_r + .1 * sin(1.3 * time + .012 * leccl);
            ib_g = ib_g + .1 * sin(1.7 * time + .019 * leccl);
            ib_b = ib_b + .1 * sin(1.9 * time + .017 * leccl);
            mv_r = .5 * (ib_r + wave_r);
            mv_g = .5 * (ib_g + wave_g);
            mv_b = .5 * (ib_b + wave_b);
            mv_a = .5 * sqr(sin(.01 * leccl + bccl));

            echo_alpha = .5 + .2 * cos(.07 * leccl + .02 * thccl);
            eo = ifcond(band(equal(bccl % 3, 0), beat), rand(4), eo);
            q3 = (equal(eo, 2) + equal(eo, 1)) * equal(bccl % 2, 0);
            q4 = (equal(eo, 0) + equal(eo, 3)) * equal(bccl % 2, 0);
            echo_orient = eo;
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Aderrasi - Candy Avian.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.0,
    fDecay: 1.0,
    fVideoEchoZoom: 0.923483,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 5,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bWaveThick: 1,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 2.063785,
    fWaveScale: 0.724297,
    fWaveSmoothing: 0.5,
    fWaveParam: -0.3,
    fModWaveAlphaStart: 0.5,
    fModWaveAlphaEnd: 1.0,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 2.500333,
    fZoomExponent: 1.0,
    fShader: 0.1,
    zoom: 0.990099,
    rot: 0.0,
    cx: 0.5,
    cy: 0.41,
    dx: -0.00399,
    dy: 1e-05,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 1.0,
    wave_g: 1.0,
    wave_b: 0.0,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.005,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.2,
    ib_size: 0.05,
    ib_r: 0.0,
    ib_g: 0.0,
    ib_b: 0.0,
    ib_a: 0.1,
    nMotionVectorsX: 55.68,
    nMotionVectorsY: 47.999996,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.25,
    mv_r: 1.0,
    mv_g: 1.0,
    mv_b: 1.0,
    mv_a: 0.0,
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.4 * sin(1.5 * time) + 0.25 * sin(2.14 * time);
            wave_b = wave_b + 0.41 * sin(1.2 * time) + 0.26 * sin(2.11 * time);
            wave_g = wave_g + 0.4 * sin(1.34 * time) + 0.25 * sin(2.34 * time);
            ib_r = 4;
            ib_g = 0;
            ib_b = 0;
            wave_x = wave_x +
                ifcond(above(wave_y, 0.75), 0.40 * sin(time), 0.15 * sin(time));
            wave_y = wave_y + 0.30 * cos(0.9 * time);
            cx = cx +
                ifcond(above(wave_x, 0.5), +0.0 * sin(7 * treb_att), -0.0 * sin(7 * mid_att));
            cy = cy +
                ifcond(above(wave_x, 0.5), +0.0 * cos(7 * bass_att), -0.0 * cos(7 * mid_att));
            ob_r = 0.5 * sin(treb) * time;
            ob_b = 0.5 * sin(mid) * 0.9 * time;
            ob_g = 0.5 * sin(bass) * 0.8 * time;
            warp = warp + ifcond(above(bass_att, 1.5), 1.5, 0);
            rot = rot + 0.08 * sin(3 * time);
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Eo.S.+Phat Fractical_dancer - pulsate B.milk"] = {
    fRating: 5.0,
    fGammaAdj: 1.0,
    fDecay: 0.94,
    fVideoEchoZoom: 0.597148,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 1,
    nWaveMode: 0,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 1,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 0.001,
    fWaveScale: 0.01,
    fWaveSmoothing: 0.63,
    fWaveParam: -1.0,
    fModWaveAlphaStart: 0.71,
    fModWaveAlphaEnd: 1.3,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 0.999998,
    fShader: 0.0,
    zoom: 13.290894,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: -0.28,
    dy: -0.32,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.0,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 1.0,
    ib_size: 0.005,
    ib_r: 0.0,
    ib_g: 0.0,
    ib_b: 0.0,
    ib_a: 1.0,
    nMotionVectorsX: 12.799995,
    nMotionVectorsY: 9.600006,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 1.0,
    mv_r: 1.0,
    mv_g: 0.91,
    mv_b: 0.71,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            rd = sqrt(sqr((x - 0.5 - q4) * 1.7) + sqr((y - 0.5 + q5) * 1.2)) + 0.001;
            cx = 0.5 + q4;
            cy = 0.5 - q5;

            zoom = pow(rd, sin(time) + 2.5) * 2.0;
            zoom = max(zoom, 0.1)

        }
    },
    init_code: function (_) {
        with(_) {

            zoom = 1;
            xpos = 0;
            ypos = 0;
        }
    },
    per_frame_code: function (_) {
        with(_) {
            decay = 1;

            vol = (bass + mid + treb) * 0.55;
            vol = vol;


            mv_r = 0.5 + 0.4 * sin(time * 1.324);
            mv_g = 0.5 + 0.4 * cos(time * 1.371);




            zoom = .9;

            musictime = musictime + vol;

            q4 = 0;
            q5 = 0;
            //=sin(musictime*0.02)*0.3;
            //q5=sin(musictime*0.01)*0.3;

            dx = sin(musictime * 0.1) * 0.07;
            dy = cos(musictime * 0.069) * 0.07;




            monitor = rot;
        }
    },
    shapes: [
        {
            enabled: 1,
            sides: 100,
            additive: 0,
            thickOutline: 0,
            textured: 0,
            x: 0.500000,
            y: 0.500000,
            rad: 0.491382,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 1.000000,
            r: 0.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
            r2: 0.000000,
            g2: 1.000000,
            b2: 0.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            per_frame_code: function (_) {
                with(_) {
                    x = .5 + q4;
                    y = .5 + q5;
                }
            },
      },
        {
            enabled: 1,
            sides: 24,
            additive: 0,
            thickOutline: 0,
            textured: 0,
            x: 0.500000,
            y: 0.500000,
            rad: 0.018423,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 0.819541,
            r: 1.000000,
            g: 1.000000,
            b: 0.000000,
            a: 1.000000,
            r2: 1.000000,
            g2: 1.000000,
            b2: 1.000000,
            a2: 1.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            per_frame_code: function (_) {
                with(_) {
                    tex_ang = 0.01;
                    x = .5 - q4;
                    y = .5 - q5;
                }
            },
      },
        {
            enabled: 0,
            sides: 4,
            additive: 0,
            thickOutline: 0,
            textured: 0,
            x: 0.500000,
            y: 0.500000,
            rad: 0.100000,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 1.000000,
            r: 1.000000,
            g: 0.000000,
            b: 0.000000,
            a: 1.000000,
            r2: 0.000000,
            g2: 1.000000,
            b2: 0.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.100000,
      },
        {
            enabled: 0,
            sides: 4,
            additive: 0,
            thickOutline: 0,
            textured: 0,
            x: 0.500000,
            y: 0.500000,
            rad: 0.100000,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 1.000000,
            r: 1.000000,
            g: 0.000000,
            b: 0.000000,
            a: 1.000000,
            r2: 0.000000,
            g2: 1.000000,
            b2: 0.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.100000,
      },
    ],
    waves: [
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
    ],
};

Presets["Phat_Rovastar_Eo.S. spiral_faces.milk"] = {
    fRating: 0.0,
    fGammaAdj: 1.0,
    fDecay: 0.925,
    fVideoEchoZoom: 1.001829,
    fVideoEchoAlpha: 0.5,
    nVideoEchoOrientation: 1,
    nWaveMode: 2,
    bAdditiveWaves: 1,
    bWaveDots: 1,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 4.099998,
    fWaveScale: 2.850136,
    fWaveSmoothing: 0.63,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.71,
    fModWaveAlphaEnd: 1.3,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 0.999514,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 1.0,
    wave_g: 0.0,
    wave_b: 0.0,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.005,
    ob_r: 0.01,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 1.0,
    ib_size: 0.005,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 1.0,
    nMotionVectorsX: 12.799995,
    nMotionVectorsY: 38.400002,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.800001,
    mv_r: 0.44,
    mv_g: 0.65,
    mv_b: 0.81,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            //flip= (-2 * above(sin(time),-0.9) )+1;
            //var=(bass+mid+treb)/3;
            //rot=((ang&rad/rad)/(var*20))/10;
            //sx=.99-(var*0.01);
            //cx=var*0.1*(ang/12);
            //sy=sx;

            zoom = .99;

            cx = 0.5 + q4;
            cy = 0.5 - q5;
            rd = sqrt(sqr((x - 0.5 - q4) * 2) + sqr((y - 0.5 + q5) * 1.5));
            //zm=(1.1-(rd/4));
            zm = .99;

            ag = atan((y - 0.5 + q5) / (x - 0.5 - q4));
            star = sin(ag / 5) * (2 - rd);
            zm = zm + star / 20;
            sx = zm;
            sy = zm;
            //rot=above(rd,0.7)/(rd+7)*(bass_att*0.1)/rd;
            dx = sin(y * 100) * (bass * 0.005) * ag / (rd * 5);
            dy = cos(x * 100) * (bass * 0.005) * ag / (rd * 5);
        }
    },
    per_frame_code: function (_) {
        with(_) {
            wave_a = 0;



            //Thanks to Zylot for rainbow generator
            counter1 = ifcond(equal(counter2, 1), ifcond(equal(counter1, 1), 0, counter1 + .2), 1);
            counter2 = ifcond(equal(counter1, 1), ifcond(equal(counter2, 1), 0, counter2 + .2), 1);
            cdelay1 = ifcond(equal(cdelay2, 1), 1, ifcond(equal(colorcounter % 2, 1), ifcond(equal(counter1, 1), 2, 0), ifcond(equal(counter2, 1), 2, 0)));
            cdelay2 = ifcond(equal(cdelay1, 2), 1, 0);
            colorcounter = ifcond(above(colorcounter, 7), 0, ifcond(equal(cdelay1, 1), colorcounter + 1, colorcounter));
            ib_r = .5 * ifcond(equal(colorcounter, 1), 1, ifcond(equal(colorcounter, 2), 1, ifcond(equal(colorcounter, 3), 1, ifcond(equal(colorcounter, 4), sin(counter2 + 2.1), ifcond(equal(colorcounter, 5), 0, ifcond(equal(colorcounter, 6), 0, sin(counter1)))))));
            ib_g = .5 * ifcond(equal(colorcounter, 1), 0, ifcond(equal(colorcounter, 2), sin(counter2 * .5), ifcond(equal(colorcounter, 3), sin((counter1 + 1.75) * .4), ifcond(equal(colorcounter, 4), 1, ifcond(equal(colorcounter, 5), 1, ifcond(equal(colorcounter, 6), sin(counter2 + 2), 0))))));
            ib_b = ifcond(equal(colorcounter, 1), sin(counter1 + 2.1), ifcond(equal(colorcounter, 2), 0, ifcond(equal(colorcounter, 3), 0, ifcond(equal(colorcounter, 4), 0, ifcond(equal(colorcounter, 5), sin(counter1), ifcond(equal(colorcounter, 6), 1, 1))))));



            //ob_r=ib_r-0.5;
            //ob_g=ib_g-0.5;
            //ob_b=ib_b-0.5;
            q1 = ib_r;
            q2 = ib_g;
            q3 = ib_b;



            decay = 1;


            //echo_orient=((bass_att+mid_att+treb_att)/3)*3;
            //solarize=above(0.5,bass);
            //darken=above(0.4,treb);

            musictime = musictime + (mid * mid * mid) * 0.02;

            xpos = sin(musictime * 0.6) * 0.3;
            ypos = sin(musictime * 0.4) * 0.3;
            q4 = xpos;
            q5 = ypos;

            ob_r = 0.3 - 0.3 * (0.5 * sin(time * 0.701) + 0.3 * cos(time * 0.438));
            ob_g = 0.6 - 0.4 * sin(time * 2.924);
            ob_b = 0.35 - 0.3 * cos(time * 0.816);
            // = cx - 0.1*sin(time*0.342);
            // = cy + 0.1*sin(time*0.433);
            //warp =0;
            ib_size = 0.02;
            ib_r = ib_r + 0.5 * sin(time * 3.034);
            ib_g = ib_g + 0.5 * sin(time * 2.547);
            ib_b = ib_b - 0.5 * sin(time * 1.431);
        }
    },
    shapes: [
        {
            enabled: 0,
            sides: 23,
            additive: 1,
            thickOutline: 0,
            textured: 1,
            x: 0.500000,
            y: 0.700000,
            rad: 0.154930,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 0.010000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
            r2: 1.000000,
            g2: 1.000000,
            b2: 1.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            per_frame_code: function (_) {
                with(_) {
                    y = bass_att * 0.5 + 0.2;
                    x = cos(time * 2) * 0.5 + 0.5;
                }
            },
      },
        {
            enabled: 0,
            sides: 4,
            additive: 0,
            thickOutline: 0,
            textured: 1,
            x: 0.500000,
            y: 0.500000,
            rad: 1.801999,
            ang: 0.000000,
            tex_ang: 3.141593,
            tex_zoom: 0.572684,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
            r2: 1.000000,
            g2: 1.000000,
            b2: 1.000000,
            a2: 1.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            per_frame_code: function (_) {
                with(_) {
                    //ang = ang + (bass*.2) + (time*.4);
                    //rad=1.781+(bass*0.025);
                    ang = above(0.5, treb_att) * .063;
                }
            },
      },
        {
            enabled: 0,
            sides: 100,
            additive: 1,
            thickOutline: 0,
            textured: 1,
            x: 0.900000,
            y: 0.500000,
            rad: 0.100000,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 0.010000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
            r2: 1.000000,
            g2: 1.000000,
            b2: 1.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.100000,
            per_frame_code: function (_) {
                with(_) {
                    x = sin(time * 5) * .4 + .5;
                    y = treb_att * 0.5;

                    pow((bass * .15), 2);
                }
            },
      },
        {
            enabled: 0,
            sides: 100,
            additive: 0,
            thickOutline: 0,
            textured: 1,
            x: 0.500000,
            y: 0.500000,
            rad: 0.033004,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 0.010000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
            r2: 1.000000,
            g2: 1.000000,
            b2: 1.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            per_frame_code: function (_) {
                with(_) {
                    x = .5 + (bass * 0.07);
                }
            },
      },
    ],
    waves: [
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 1,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
            per_point_code: function (_) {
                with(_) {
                    //plot x,y,z to point on circle
                    smp = sample * 6.283;
                    xp = sin(smp) * 0.20;
                    yp = cos(smp) * 0.20;
                    zp = 0;


                    //alter shape;
                    angy = sin(sample * 6.28 * 4 + t1) * 6.28;
                    xq = xp * cos(angy) - zp * sin(angy);
                    zq = xp * sin(angy) + zp * cos(angy);
                    xp = xq;
                    zp = zq;


                    //rotate on y axis;
                    angy = t1 * 0.1;
                    xq = xp * cos(angy) - zp * sin(angy);
                    zq = xp * sin(angy) + zp * cos(angy);
                    xp = xq;
                    zp = zq;

                    //rotate on x axis
                    axs1 = sin(t1 * 0.15) + 1.6;
                    yq = yp * cos(axs1) - zp * sin(axs1);
                    zq = yp * sin(axs1) + zp * cos(axs1);
                    yp = yq;
                    zp = zq;

                    //rotate on y axis again
                    axs2 = sin(t1 * 0.1) * 3.3;
                    xq = xp * cos(axs2) - zp * sin(axs2);
                    zq = xp * sin(axs2) + zp * cos(axs2);
                    xp = xq;
                    zp = zq;

                    //stretch y axis to compensate for aspect ratio
                    yp = yp * 1.2;

                    //push forward into viewpace
                    zp = zp + 2.1;

                    //project x,y,z into screenspace
                    xs = xp / zp;
                    ys = yp / zp;

                    //center 0,0 in middle of screen
                    x = xs + 0.5 + q4;
                    y = ys + 0.5 + q5;

                    r = 1 - q1;
                    g = 1 - q2;
                    b = 1 - q3;
                }
            },
            per_frame_code: function (_) {
                with(_) {
                    basstime = basstime + (bass * bass);
                    t1 = basstime * 0.003;

                }
            },
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
    ],
};

Presets["Rovastar - Explosive Minds.milk"] = {
    fRating: 5.0,
    fGammaAdj: 2.0,
    fDecay: 1.0,
    fVideoEchoZoom: 0.999608,
    fVideoEchoAlpha: 0.5,
    nVideoEchoOrientation: 2,
    nWaveMode: 0,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bWaveThick: 1,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 0,
    bDarkenCenter: 1,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 0.8,
    fWaveScale: 0.011046,
    fWaveSmoothing: 0.75,
    fWaveParam: -0.42,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.0,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.0,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 1.0,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.5,
    wave_g: 0.5,
    wave_b: 0.5,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.01,
    ob_r: 1.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.9,
    ib_size: 0.01,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 0.0,
    nMotionVectorsX: 1.28,
    nMotionVectorsY: 1.248,
    mv_dx: -0.06,
    mv_dy: -0.026,
    mv_l: 5.0,
    mv_r: 1.0,
    mv_g: 1.0,
    mv_b: 1.0,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            zoom = q1 + rad * sin(ang * 25) * .05;
        }
    },
    per_frame_code: function (_) {
        with(_) {
            warp = 0;
            wave_r = bass_att * .3;
            wave_g = treb_att * .3;
            wave_b = mid_att * .3;
            ob_r = 0.5 + 0.5 * sin(time * 5.12);
            ob_b = 0.5 + 0.5 * sin(time * 6.112);
            ob_g = 0.5 + 0.5 * sin(time * 7.212);
            q1 = zoom + pow((bass + bass_att), 3) * .005 - .02;
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Rovastar - Forgotten Moon.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.0,
    fDecay: 1.0,
    fVideoEchoZoom: 1.006596,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 3,
    nWaveMode: 8,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bWaveThick: 1,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 4.099998,
    fWaveScale: 0.015199,
    fWaveSmoothing: 0.63,
    fWaveParam: -0.34,
    fModWaveAlphaStart: 0.71,
    fModWaveAlphaEnd: 1.3,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.0,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.1,
    wave_y: 0.86,
    ob_size: 0.005,
    ob_r: 0.01,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 1.0,
    ib_size: 0.005,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 1.0,
    nMotionVectorsX: 64.0,
    nMotionVectorsY: 48.0,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.5,
    mv_r: 0.35,
    mv_g: 0.35,
    mv_b: 0.35,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            dx = 0.01 * sin(100 * y + q8 / y);
            dy = 0.01 * sin(100 * x + q8 / x);
        }
    },
    init_code: function (_) {
        with(_) {
            q8 = 0;
        }
    },
    per_frame_code: function (_) {
        with(_) {
            warp = 0;
            ib_r = 0.5 + 0.5 * sin(time);
            ib_g = 0.5 + 0.5 * sin(time * 1.576);
            wave_r = wave_r + 0.350 * (0.60 * sin(0.980 * time) + 0.40 * sin(1.047 * time));
            wave_g = wave_g + 0.350 * (0.60 * sin(0.835 * time) + 0.40 * sin(1.081 * time));
            wave_b = wave_b + 0.350 * (0.60 * sin(0.814 * time) + 0.40 * sin(1.011 * time));
            q8 = oldq8 + 0.0002 * (pow(1 + 1.2 * bass + 0.4 * bass_att + 0.1 * treb + 0.1 * treb_att + 0.1 * mid + 0.1 * mid_att, 6) / fps);
            oldq8 = q8;
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Rovastar - Magic Carpet.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.98,
    fDecay: 0.994,
    fVideoEchoZoom: 1.006596,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 8,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 4.099998,
    fWaveScale: 0.013223,
    fWaveSmoothing: 0.63,
    fWaveParam: -0.34,
    fModWaveAlphaStart: 0.71,
    fModWaveAlphaEnd: 1.3,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.0,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.1,
    wave_y: 0.86,
    ob_size: 0.0,
    ob_r: 0.5,
    ob_g: 0.5,
    ob_b: 0.5,
    ob_a: 0.0,
    ib_size: 0.005,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 1.0,
    nMotionVectorsX: 64.0,
    nMotionVectorsY: 2.4,
    mv_dx: 0.0,
    mv_dy: -0.1,
    mv_l: 5.0,
    mv_r: 1.0,
    mv_g: 1.0,
    mv_b: 1.0,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            dx = 0.008 * sin(100 * y + (q8 * y));
            dy = 0.008 * sin(100 * x + (q8 * x));
        }
    },
    init_code: function (_) {
        with(_) {
            q8 = 0;
        }
    },
    per_frame_code: function (_) {
        with(_) {
            warp = 0;
            q8 = oldq8 + 0.0003 * (pow(1 + 1.2 * bass + 0.4 * bass_att + 0.1 * treb + 0.1 * treb_att + 0.1 * mid + 0.1 * mid_att, 6) / fps);
            oldq8 = q8;
            ib_r = 0.5 + 0.5 * sin(1.123 * q8);
            ib_g = 0.5 + 0.5 * sin(q8 * 1.576);
            ib_b = 0.5 + 0.5 * cos(q8 * 1.465);
            wave_a = 0;
            decay = 0.990 + abs(0.01 * sin(0.321 * q8));
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Geiss - Cosmic Dust 2.milk"] = {
    fRating: 4.0,
    fGammaAdj: 1.9,
    fDecay: 0.98,
    fVideoEchoZoom: 1.16936,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 5,
    bAdditiveWaves: 1,
    bWaveDots: 1,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bMotionVectorsOn: 0,
    bRedBlueStereo: 0,
    nMotionVectorsX: 12,
    nMotionVectorsY: 9,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 3.299999,
    fWaveScale: 1.694,
    fWaveSmoothing: 0.9,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 3.138,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.053,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.263,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.5,
    wave_g: 0.5,
    wave_b: 0.8,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.01,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.0,
    ib_size: 0.01,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 0.0,
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.650 * (0.60 * sin(1.437 * time) + 0.40 * sin(0.970 * time));
            wave_g = wave_g + 0.650 * (0.60 * sin(1.344 * time) + 0.40 * sin(0.841 * time));
            wave_b = wave_b + 0.650 * (0.60 * sin(1.251 * time) + 0.40 * sin(1.055 * time));
            rot = rot + 0.010 * (0.60 * sin(0.381 * time) + 0.40 * sin(0.579 * time));
            cx = cx + 0.210 * (0.60 * sin(0.374 * time) + 0.40 * sin(0.294 * time));
            cy = cy + 0.210 * (0.60 * sin(0.393 * time) + 0.40 * sin(0.223 * time));
            dx = dx + 0.010 * (0.60 * sin(0.234 * time) + 0.40 * sin(0.277 * time));
            dy = dy + 0.010 * (0.60 * sin(0.284 * time) + 0.40 * sin(0.247 * time));
            decay = decay - 0.01 * equal(frame % 6, 0);
            dx = dx + dx_residual;
            dy = dy + dy_residual;
            bass_thresh = above(bass_att, bass_thresh) * 2 + (1 - above(bass_att, bass_thresh)) * ((bass_thresh - 1.3) * 0.96 + 1.3);
            dx_residual = equal(bass_thresh, 2) * 0.016 * sin(time * 7) + (1 - equal(bass_thresh, 2)) * dx_residual;
            dy_residual = equal(bass_thresh, 2) * 0.012 * sin(time * 9) + (1 - equal(bass_thresh, 2)) * dy_residual;
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Geiss - Cruzin'.milk"] = {
    fGammaAdj: 2.0,
    fDecay: 0.98,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 6,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bMotionVectorsOn: 0,
    bRedBlueStereo: 0,
    nMotionVectorsX: 12,
    nMotionVectorsY: 9,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 4.0,
    fWaveScale: 1.691672,
    fWaveSmoothing: 0.5,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 3.138,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.0003,
    rot: 0.0,
    cx: 0.5,
    cy: 0.11,
    dx: 0.0,
    dy: -0.001,
    warp: 0.0243,
    sx: 1.001992,
    sy: 1.004987,
    wave_r: 0.0,
    wave_g: 0.57,
    wave_b: 1.0,
    wave_x: 0.65,
    wave_y: 0.5,
    fRating: 4.0,
    per_pixel_code: function (_) {
        with(_) {
            du = (x - cx) * 2;
            dv = (y - cy) * 2;
            q = 0.01 * pow(du * du + dv * dv, 1.5);
            dx = q * du;
            dy = q * dv;

        }
    },
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.250 * (0.60 * sin(10.937 * time) + 0.40 * sin(1.470 * time));
            wave_g = wave_g + 0.300 * (0.60 * sin(11.344 * time) + 0.40 * sin(1.041 * time));
            wave_b = wave_b + 0.250 * (0.60 * sin(21.251 * time) + 0.40 * sin(1.355 * time));
            rot = rot + 0.004 * (0.60 * sin(0.381 * time) + 0.40 * sin(0.579 * time));
            cx = cx + 0.110 * (0.60 * sin(0.374 * time) + 0.40 * sin(0.294 * time));
            cy = cy + 0.110 * (0.60 * sin(0.393 * time) + 0.40 * sin(0.223 * time));
            decay = decay - 0.01 * equal(frame % 6, 0);
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Geiss - Downward Spiral.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.9,
    fDecay: 0.98,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 7,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bWaveThick: 1,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 1.0,
    fWaveScale: 2.717574,
    fWaveSmoothing: 0.9,
    fWaveParam: 1.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 2.853,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 0.99,
    rot: 0.06,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.0,
    sx: 1.0,
    sy: 0.9999,
    wave_r: 1.0,
    wave_g: 0.4,
    wave_b: 0.1,
    wave_x: 0.5,
    wave_y: 0.6,
    ob_size: 0.01,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.0,
    ib_size: 0.01,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 0.0,
    nMotionVectorsX: 12.0,
    nMotionVectorsY: 9.0,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.9,
    mv_r: 1.0,
    mv_g: 1.0,
    mv_b: 1.0,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            rot = rot * (-0.2 + pow(cos(rad * 8 + ang - time * 0.8), 2));
        }
    },
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.120 * (0.60 * sin(0.733 * time) + 0.40 * sin(0.345 * time));
            wave_g = wave_g + 0.120 * (0.60 * sin(0.600 * time) + 0.40 * sin(0.456 * time));
            wave_b = wave_b + 0.100 * (0.60 * sin(0.510 * time) + 0.40 * sin(0.550 * time));
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Geiss - Dynamic Swirls 1.milk"] = {
    fGammaAdj: 2.7,
    fDecay: 0.97,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 7,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bMotionVectorsOn: 0,
    bRedBlueStereo: 0,
    nMotionVectorsX: 12,
    nMotionVectorsY: 9,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 1.0,
    fWaveScale: 0.634243,
    fWaveSmoothing: 0.1,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.00496,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.000156,
    sx: 0.999666,
    sy: 0.9999,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.38,
    fRating: 2.0,
    per_pixel_code: function (_) {
        with(_) {
            du = x * 2 - 1 - q1;
            dv = y * 2 - 1 - q2;
            dist = sqrt(du * du + dv * dv);
            ang2 = atan2(du, dv);
            mult = 0.008 / (dist + 0.4);
            dx = mult * sin(ang2 - 1.5);
            dy = mult * cos(ang2 - 1.5);
            du = x * 2 - 1 - q3;
            dv = y * 2 - 1 - q4;
            dist = sqrt(du * du + dv * dv);
            ang2 = atan2(du, dv);
            mult = 0.008 / (dist + 0.4);
            dx = dx + mult * sin(ang2 + 1.5);
            dy = dy + mult * cos(ang2 + 1.5);
        }
    },
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.350 * (0.60 * sin(0.980 * time) + 0.40 * sin(1.047 * time));
            wave_g = wave_g + 0.350 * (0.60 * sin(0.835 * time) + 0.40 * sin(1.081 * time));
            wave_b = wave_b + 0.350 * (0.60 * sin(0.814 * time) + 0.40 * sin(1.011 * time));
            q1 = (cx * 2 - 1) + 0.62 * (0.60 * sin(0.374 * time) + 0.40 * sin(0.294 * time));
            q2 = (cy * 2 - 1) + 0.62 * (0.60 * sin(0.393 * time) + 0.40 * sin(0.223 * time));
            q3 = (cx * 2 - 1) + 0.62 * (0.60 * sin(0.174 * -time) + 0.40 * sin(0.364 * time));
            q4 = (cy * 2 - 1) + 0.62 * (0.60 * sin(0.234 * time) + 0.40 * sin(0.271 * -time));
            decay = decay - 0.01 * equal(frame % 5, 0);
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Geiss - Dynamic Swirls 2.milk"] = {
    fGammaAdj: 2.7,
    fDecay: 0.98,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 6,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bMotionVectorsOn: 0,
    bRedBlueStereo: 0,
    nMotionVectorsX: 12,
    nMotionVectorsY: 9,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 1.1,
    fWaveScale: 4.695139,
    fWaveSmoothing: 0.9,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.67,
    fModWaveAlphaEnd: 0.97,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.007964,
    rot: 0.02,
    cx: 0.499999,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.000156,
    sx: 0.999667,
    sy: 0.9999,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.7,
    fRating: 2.0,
    per_pixel_code: function (_) {
        with(_) {
            du = x * 2 - 1 - q1;
            dv = y * 2 - 1 - q2;
            dist = sqrt(du * du + dv * dv);
            ang2 = atan2(du, dv);
            mult = 0.012 / (dist + 0.4);
            dx = mult * sin(ang2 - 1.5);
            dy = mult * cos(ang2 - 1.5);
            du = x * 2 - 1 - q3;
            dv = y * 2 - 1 - q4;
            dist = sqrt(du * du + dv * dv);
            ang2 = atan2(du, dv);
            mult = 0.012 / (dist + 0.4);
            dx = dx + mult * sin(ang2 + 1.5);
            dy = dy + mult * cos(ang2 + 1.5);
        }
    },
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.350 * (0.60 * sin(0.980 * time) + 0.40 * sin(1.047 * time));
            wave_g = wave_g + 0.350 * (0.60 * sin(0.835 * time) + 0.40 * sin(1.081 * time));
            wave_b = wave_b + 0.350 * (0.60 * sin(0.814 * time) + 0.40 * sin(1.011 * time));
            q1 = (cx * 2 - 1) + 0.32 * (0.60 * sin(0.374 * time) + 0.40 * sin(0.294 * time));
            q2 = (cy * 2 - 1) + 0.52 * (0.60 * sin(0.393 * time) + 0.40 * sin(0.223 * time));
            q3 = (cx * 2 - 1) + 0.32 * (0.60 * sin(0.174 * -time) + 0.40 * sin(0.364 * time));
            q4 = (cy * 2 - 1) + 0.52 * (0.60 * sin(0.234 * time) + 0.40 * sin(0.271 * -time));
            decay = decay - 0.01 * equal(frame % 5, 0);
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Geiss - Swirlie 4.milk"] = {
    fRating: 1.0,
    fGammaAdj: 1.994,
    fDecay: 0.97,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 1,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bMotionVectorsOn: 0,
    bRedBlueStereo: 0,
    nMotionVectorsX: 12,
    nMotionVectorsY: 9,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 4.499998,
    fWaveScale: 1.524161,
    fWaveSmoothing: 0.9,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 0.334695,
    fWarpScale: 3.928016,
    fZoomExponent: 2.1,
    fShader: 0.0,
    zoom: 0.961,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 1.771011,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.0,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.5,
    ib_size: 0.0285,
    ib_r: 0.34,
    ib_g: 0.34,
    ib_b: 0.34,
    ib_a: 0.1,
    per_frame_code: function (_) {
        with(_) {
            wave_x = wave_x + 0.2900 * (0.60 * sin(2.121 * time) + 0.40 * sin(1.621 * time));
            wave_y = wave_y + 0.2900 * (0.60 * sin(1.742 * time) + 0.40 * sin(2.322 * time));
            wave_r = wave_r + 0.350 * (0.60 * sin(0.823 * time) + 0.40 * sin(0.916 * time));
            wave_g = wave_g + 0.350 * (0.60 * sin(0.900 * time) + 0.40 * sin(1.023 * time));
            wave_b = wave_b + 0.350 * (0.60 * sin(0.808 * time) + 0.40 * sin(0.949 * time));
            blah = 0.5 / (wave_r + wave_g + wave_b);
            wave_r = wave_r * blah;
            wave_g = wave_g * blah;
            wave_b = wave_b * blah;
            rot = rot + 0.35 * (0.60 * sin(0.21 * time) + 0.30 * sin(0.339 * time));
            cx = cx + 0.30 * (0.60 * sin(0.374 * time) + 0.14 * sin(0.194 * time));
            cy = cy + 0.37 * (0.60 * sin(0.274 * time) + 0.10 * sin(0.394 * time));
            dx = dx + 0.01 * (0.60 * sin(0.324 * time) + 0.40 * sin(0.234 * time));
            dy = dy + 0.01 * (0.60 * sin(0.244 * time) + 0.40 * sin(0.264 * time));
            ib_r = ib_r + 0.2 * sin(time * 0.5413);
            ib_g = ib_g + 0.2 * sin(time * 0.6459);
            ib_b = ib_b + 0.2 * sin(time * 0.7354);
            blah = 12.4 / (ib_r + ib_g + ib_b) * 3;
            ib_r = ib_r * blah;
            ib_g = ib_g * blah;
            ib_b = ib_b * blah;

        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Geiss - Swirlie 5.milk"] = {
    fRating: 2.0,
    fGammaAdj: 1.994,
    fDecay: 0.99,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 7,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bMotionVectorsOn: 0,
    bRedBlueStereo: 0,
    nMotionVectorsX: 12,
    nMotionVectorsY: 9,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 0.0,
    fWaveScale: 1.693514,
    fWaveSmoothing: 0.9,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 0.451118,
    fWarpScale: 3.928016,
    fZoomExponent: 2.1,
    fShader: 0.0,
    zoom: 0.961,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 7.397955,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.95,
    ob_size: 0.03,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.5,
    ib_size: 0.01,
    ib_r: 0.34,
    ib_g: 0.34,
    ib_b: 0.34,
    ib_a: 0.5,
    per_frame_code: function (_) {
        with(_) {
            wave_x = wave_x + 0.0200 * (0.60 * sin(0.821 * time) + 0.40 * sin(0.621 * time));
            wave_y = wave_y + 0.0200 * (0.60 * sin(0.942 * time) + 0.40 * sin(0.722 * time));
            wave_r = wave_r + 0.350 * (0.60 * sin(0.823 * time) + 0.40 * sin(0.916 * time));
            wave_g = wave_g + 0.350 * (0.60 * sin(0.900 * time) + 0.40 * sin(1.023 * time));
            wave_b = wave_b + 0.350 * (0.60 * sin(0.808 * time) + 0.40 * sin(0.949 * time));
            rot = rot + 0.35 * (0.60 * sin(0.21 * time) + 0.30 * sin(0.339 * time));
            cx = cx + 0.30 * (0.60 * sin(0.374 * time) + 0.14 * sin(0.194 * time));
            cy = cy + 0.37 * (0.60 * sin(0.274 * time) + 0.10 * sin(0.394 * time));
            ib_r = ib_r + 0.2 * sin(time * 0.5413);
            ib_g = ib_g + 0.2 * sin(time * 0.6459);
            ib_b = ib_b + 0.2 * sin(time * 0.7354);

        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Krash - Digital Flame.milk"] = {
    fRating: 3.0,
    fGammaAdj: 2.0,
    fDecay: 0.9,
    fVideoEchoZoom: 1.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 6,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 1.0,
    fWaveScale: 0.3697,
    fWaveSmoothing: 0.75,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 53.523884,
    fWarpScale: 0.408391,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.0,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 1.0,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.6999,
    wave_g: 0.6,
    wave_b: 0.8,
    wave_x: 0.0,
    wave_y: 0.5,
    ob_size: 0.0,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.0,
    ib_size: 0.0,
    ib_r: 0.0,
    ib_g: 0.0,
    ib_b: 0.0,
    ib_a: 0.0,
    nMotionVectorsX: 12.0,
    nMotionVectorsY: 9.0,
    mv_l: 0.9,
    mv_r: 1.0,
    mv_g: 1.0,
    mv_b: 1.0,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            dy = -0.1 * (q1 - 1) * log(2 - (abs(y * 2 - 1.8)));
            dy = below(dy, 0.02) * dy - 0.02;
            dy = dy + 0.01 * (sin((x * q2 * 0.483) + (y * q2 * 1.238)) + sin((x * q2 * 1.612) + (y * q2 * 0.648)));
        }
    },
    per_frame_code: function (_) {
        with(_) {
            q1 = (bass_att + mid_att + treb_att) / 3;
            q2 = time + 1000;
            bass_thresh = above(bass_att, bass_thresh) * 2 + (1 - above(bass_att, bass_thresh)) * ((bass_thresh - 1.4) * 0.95 + 1.4);
            treb_thresh = above(treb_att, treb_thresh) * 2 + (1 - above(treb_att, treb_thresh)) * ((treb_thresh - 1.5) * 0.85 + 1.2);
            bass_on = above(bass_thresh, 1.9);
            treb_on = above(treb_thresh, 1.9);
            swapcolour = bass_on - treb_on;
            red_aim = ifcond(equal(swapcolour, 1), 1, ifcond(equal(swapcolour, 0), 0.9, 0.7));
            green_aim = ifcond(equal(swapcolour, 1), 0.7, ifcond(equal(swapcolour, 0), 0.3, 0.6));
            blue_aim = ifcond(equal(swapcolour, 1), 0, ifcond(equal(swapcolour, 0), 0.2, 0.8));
            red = red + (red_aim - red) * 0.5;
            green = green + (green_aim - green) * 0.5;
            blue = blue + (blue_aim - blue) * 0.5;
            wave_r = red;
            wave_g = green;
            wave_b = blue;
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Rovastar & Geiss - Dynamic Swirls 3 (Twisted Truth Mix).milk"] = {
    fRating: 2.0,
    fGammaAdj: 2.994,
    fDecay: 0.965,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 7,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bWaveThick: 1,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 1.0,
    fWaveScale: 0.634243,
    fWaveSmoothing: 0.1,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.00496,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.000156,
    sx: 0.999666,
    sy: 0.9999,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.38,
    ob_size: 0.005,
    ob_r: 1.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 1.0,
    ib_size: 0.01,
    ib_r: 0.0,
    ib_g: 0.0,
    ib_b: 0.0,
    ib_a: 0.47,
    nMotionVectorsX: 64.0,
    nMotionVectorsY: 2.016,
    mv_dx: 0.0,
    mv_dy: -0.1,
    mv_l: 5.0,
    mv_r: 0.0,
    mv_g: 0.0,
    mv_b: 0.7,
    mv_a: 0.5,
    per_pixel_code: function (_) {
        with(_) {
            du = x * 2 - 1 - q1;
            dv = y * 2 - 1 - q2;
            dist = sqrt(du * du + dv * dv);
            ang2 = atan2(du, dv);
            mult = 0.008 / (dist + 0.4);
            dx = mult * sin(ang2 - 1.5);
            dy = mult * cos(ang2 - 1.5);
            du = x * 2 - 1 - q3;
            dv = y * 2 - 1 - q4;
            dist = sqrt(du * du + dv * dv);
            ang2 = atan2(du, dv);
            mult = 0.008 / (dist + 0.4);
            dx = dx + mult * sin(ang2 + 1.5);
            dy = dy + mult * cos(ang2 + 1.5);
        }
    },
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.350 * (0.60 * sin(0.980 * time) + 0.40 * sin(1.047 * time));
            wave_g = wave_g + 0.350 * (0.60 * sin(0.835 * time) + 0.40 * sin(1.081 * time));
            wave_b = wave_b + 0.350 * (0.60 * sin(0.814 * time) + 0.40 * sin(1.011 * time));
            //q8 = oldq8+min(if(above(bass+bass_att,2.8),q8+0.025*pow((bass+bass_att-2),5),0),1);
            //oldq8 = q8;
            //q8 = q8 + time*0.1;
            q8 = oldq8 + 0.005 * (pow(1.2 * bass + 0.4 * bass_att + 0.1 * treb + 0.1 * treb_att + 0.1 * mid + 0.1 * mid_att, 6) / fps);
            oldq8 = q8;
            monitor = q8;
            q1 = 0.62 * (0.60 * sin(0.374 * q8) + 0.40 * sin(0.294 * q8));
            q2 = 0.62 * (0.60 * sin(0.393 * q8) + 0.40 * sin(0.223 * q8));
            q3 = 0.62 * (0.60 * sin(0.174 * -q8) + 0.40 * sin(0.364 * q8));
            q4 = 0.62 * (0.60 * sin(0.234 * q8) + 0.40 * sin(0.271 * -q8));
            ob_r = wave_r;
            ob_g = wave_g;
            ob_b = wave_b;
            mv_r = wave_r;
            mv_b = wave_b;
            mv_g = wave_g;
            ib_a = abs(sin(q8 * 0.9141));
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Rovastar & Geiss - Dynamic Swirls 3 (Voyage Of Twisted Souls Mix).milk"] = {
    fRating: 2.0,
    fGammaAdj: 1.993,
    fDecay: 0.98,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 7,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bWaveThick: 1,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 0.608039,
    fWaveScale: 0.634243,
    fWaveSmoothing: 0.1,
    fWaveParam: 0.5,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.00496,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.000156,
    sx: 0.999666,
    sy: 0.9999,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.36,
    ob_size: 0.01,
    ob_r: 1.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 1.0,
    ib_size: 0.015,
    ib_r: 0.0,
    ib_g: 0.0,
    ib_b: 0.0,
    ib_a: 1.0,
    nMotionVectorsX: 64.0,
    nMotionVectorsY: 48.0,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.15,
    mv_r: 0.0,
    mv_g: 0.0,
    mv_b: 1.0,
    mv_a: 0.4,
    per_pixel_code: function (_) {
        with(_) {
            du = x * 2 - 1 - q1;
            dv = y * 2 - 1 - q2;
            dist = sqrt(du * du + dv * dv);
            ang2 = atan2(du, dv);
            mult = 0.008 / (dist + 0.4);
            dx = mult * sin(ang2 - 1.5);
            dy = mult * cos(ang2 - 1.5);
            du = x * 2 - 1 - q3;
            dv = y * 2 - 1 - q4;
            dist = sqrt(du * du + dv * dv);
            ang2 = atan2(du, dv);
            mult = 0.008 * sin(q8) / (dist + 0.4);
            dx = dx + mult * sin(ang2 + 1.5);
            dy = dy + mult * cos(ang2 + 1.5);
            //rot = -0.01*rad*sin(q8);
            rot = 0 + abs(3 * dx) - abs(3 * dy);
            zoom = 1 + abs(3 * dx) - abs(3 * dy);
            zoomexp = 1 + abs((300 * dx) - (300 * dy));
        }
    },
    per_frame_code: function (_) {
        with(_) {
            ob_r = 0.7 - 0.3 * (0.5 * sin(time * 0.701) + 0.3 * cos(time * 0.438));
            ob_g = 0.5 - 0.48 * sin(time * 1.324);
            ob_b = 0.5 - 0.48 * cos(time * 1.316);
            wave_r = wave_r + 0.350 * (0.60 * sin(0.980 * time) + 0.40 * sin(1.047 * time));
            wave_g = wave_g + 0.350 * (0.60 * sin(0.835 * time) + 0.40 * sin(1.081 * time));
            wave_b = wave_b + 0.350 * (0.60 * sin(0.814 * time) + 0.40 * sin(1.011 * time));
            mv_r = wave_r;
            mv_b = wave_b;
            mv_g = wave_g;
            q8 = oldq8 + ifcond(above(bass + bass_att, 2.8), q8 + 0.005 * pow((bass + bass_att), 5), 0);
            oldq8 = q8;
            monitor = sin(q8);
            q1 = 0.62 * (0.60 * sin(0.374 * q8) + 0.40 * sin(0.294 * q8));
            q2 = 0.62 * (0.60 * sin(0.393 * q8) + 0.40 * sin(0.223 * q8));
            q3 = 0.62 * (0.60 * sin(0.174 * -q8) + 0.40 * sin(0.364 * q8));
            q4 = 0.62 * (0.60 * sin(0.234 * q8) + 0.40 * sin(0.271 * -q8));
            //zoom = zoom+ 0.06*abs(sin(q8));
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Rovastar & Geiss - Surface (Vectrip Mix).milk"] = {
    fRating: 3.0,
    fGammaAdj: 2.7,
    fDecay: 0.98,
    fVideoEchoZoom: 2.0,
    fVideoEchoAlpha: 0.0,
    nVideoEchoOrientation: 0,
    nWaveMode: 4,
    bAdditiveWaves: 0,
    bWaveDots: 0,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 1,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 2.706706,
    fWaveScale: 0.234487,
    fWaveSmoothing: 0.1,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.75,
    fModWaveAlphaEnd: 0.95,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 1.014,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.029439,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.01,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 0.0,
    ib_size: 0.01,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 0.0,
    nMotionVectorsX: 12.0,
    nMotionVectorsY: 9.0,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.9,
    mv_r: 0.53,
    mv_g: 0.7,
    mv_b: 0.33,
    mv_a: 1.0,
    per_frame_code: function (_) {
        with(_) {
            wave_r = wave_r + 0.350 * (0.60 * sin(0.980 * time) + 0.40 * sin(1.047 * time));
            wave_g = wave_g + 0.350 * (0.60 * sin(0.835 * time) + 0.40 * sin(1.081 * time));
            wave_b = wave_b + 0.350 * (0.60 * sin(0.814 * time) + 0.40 * sin(1.011 * time));
            cx = cx + 0.110 * (0.60 * sin(0.374 * time) + 0.40 * sin(0.294 * time));
            cy = cy + 0.110 * (0.60 * sin(0.393 * time) + 0.40 * sin(0.223 * time));
            dx = dx + 0.01 * (0.60 * sin(0.173 * time) + 0.40 * sin(0.223 * time));
            vol = (bass + mid + att) / 6;
            xamptarg = ifcond(equal(frame % 15, 0), min(0.5 * vol * bass_att, 0.5), xamptarg);
            xamp = xamp + 0.5 * (xamptarg - xamp);
            xdir = ifcond(above(abs(xpos), xamp), -sign(xpos), ifcond(below(abs(xspeed), 0.1), 2 * above(xpos, 0) - 1, xdir));
            xaccel = xdir * xamp - xpos - xspeed * 0.055 * below(abs(xpos), xamp);
            xspeed = xspeed + xdir * xamp - xpos - xspeed * 0.055 * below(abs(xpos), xamp);
            xpos = xpos + 0.001 * xspeed;
            yamptarg = ifcond(equal(frame % 15, 0), min(0.3 * vol * treb_att, 0.5), yamptarg);
            yamp = yamp + 0.5 * (yamptarg - yamp);
            ydir = ifcond(above(abs(ypos), yamp), -sign(ypos), ifcond(below(abs(yspeed), 0.1), 2 * above(ypos, 0) - 1, ydir));
            yaccel = ydir * yamp - ypos - yspeed * 0.055 * below(abs(ypos), yamp);
            yspeed = yspeed + ydir * yamp - ypos - yspeed * 0.055 * below(abs(ypos), yamp);
            ypos = ypos + 0.001 * yspeed;
            mv_x_speed = 4;
            mv_y_speed = 4;
            mv_x_range = 0.49;
            mv_y_range = 0.049;
            mv_x_amount = 20;
            mv_y_amount = 2.25;
            mv_x = mv_x_amount + mv_x_range + mv_x_range * sin(mv_x_speed * ypos + (sin(time * 0.964) - 0.5 * cos(time * 0.256)));
            mv_y = mv_y_amount + mv_y_range + mv_y_range * sin(mv_y_speed * xpos - (cos(time * 1.345) - 0.5 * cos(time * 0.331)));
            mv_b = mv_b + 0.2 * sin(time * 0.771);
            mv_r = mv_r + 0.25 * cos(time * 1.701);
            mv_g = mv_g + 0.3 * cos(time * 0.601);
            mv_l = 10 + 6 * min((0.5 * bass + 0.5 * bass_att), 2);
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Rovastar & Idiot24-7 - Balk Acid.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.0,
    fDecay: 1.0,
    fVideoEchoZoom: 0.999514,
    fVideoEchoAlpha: 0.5,
    nVideoEchoOrientation: 1,
    nWaveMode: 7,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 100.0,
    fWaveScale: 0.591236,
    fWaveSmoothing: 0.0,
    fWaveParam: 1.0,
    fModWaveAlphaStart: 0.71,
    fModWaveAlphaEnd: 1.3,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 0.01,
    fShader: 0.0,
    zoom: 1.0003,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.4,
    wave_g: 1.0,
    wave_b: 0.6,
    wave_x: 0.5,
    wave_y: 1.0,
    ob_size: 0.005,
    ob_r: 1.0,
    ob_g: 1.0,
    ob_b: 0.41,
    ob_a: 1.0,
    ib_size: 0.005,
    ib_r: 0.0,
    ib_g: 0.0,
    ib_b: 0.0,
    ib_a: 1.0,
    nMotionVectorsX: 12.799995,
    nMotionVectorsY: 2.8799,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 3.0,
    mv_r: 0.0,
    mv_g: 0.7,
    mv_b: 1.0,
    mv_a: 0.4,
    per_frame_code: function (_) {
        with(_) {
            zoom = zoom + 0.028 * (bass + bass_att) - 0.05;
            rot = rot + 0.10 * sin(time);
            mv_r = 0.5 + 0.5 * sin(time * 1.23);
            mv_b = 0.5 + 0.5 * sin(time * 1.26);
            mv_g = 0.5 + 0.5 * sin(time * 1.19);
            wave_g = wave_g * +.20 * sin(time * .13);
            wave_r = wave_r + .13 * sin(time);
            wave_b = wave_b * sin(time);
            wave_x = wave_x - .5 * sin(time * .13);
            ob_a = ifcond(above(mid + treb, 2.6), 1, 0);
            ob_r = 0.5 + 0.4 * sin(time * 2.87);
            ob_b = 0.5 + 0.4 * sin(time * 2.914);
            ob_g = 0.5 + 0.4 * sin(time * 2.768);
            mv_y = 3.25;
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["shifter - flashburn.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.0,
    fDecay: 0.995,
    fVideoEchoZoom: 0.999608,
    fVideoEchoAlpha: 0.5,
    nVideoEchoOrientation: 1,
    nWaveMode: 7,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 1,
    bMaximizeWaveColor: 0,
    bTexWrap: 1,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 0.007768,
    fWaveScale: 1.285751,
    fWaveSmoothing: 0.63,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.71,
    fModWaveAlphaEnd: 1.3,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 0.055821,
    fShader: 0.0,
    zoom: 0.970118,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.0005,
    ob_r: 0.0,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 1.0,
    ib_size: 0.26,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 0.0,
    nMotionVectorsX: 12.0,
    nMotionVectorsY: 9.0,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.9,
    mv_r: 1.0,
    mv_g: 1.0,
    mv_b: 1.0,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            azoom = -0.95 + 0.4 * (x - 0.5) + 0.4 * (y - 0.5);
        }
    },
    per_frame_code: function (_) {
        with(_) {
            azoom = -.95;
            decay = decay - .001;
        }
    },
    shapes: [
        {
            enabled: 1,
            sides: 15,
            additive: 0,
            thickOutline: 0,
            textured: 0,
            x: 0.500000,
            y: 0.500000,
            rad: 0.100000,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 1.000000,
            r: 1.000000,
            g: 0.000000,
            b: 0.000000,
            a: 1.000000,
            r2: 0.000000,
            g2: 1.000000,
            b2: 1.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            init_code: function (_) {
                with(_) {
                    set = rand(20);
                }
            },
            per_frame_code: function (_) {
                with(_) {
                    x = 0.5 + 0.5 * (sin(time * 1.4) * 0.4 + 0.3 * sin(time * 1.9) + 0.3 * sin(time * (1 + set * 0.05)));
                    y = 0.5 + 0.5 * (sin(time * 1.2) * 0.7 + 0.3 * sin(time * 1.6));

                    r = 0.5 + 0.5 * sin(time);
                    g = 0.5 + 0.5 * sin(time + 2.094);
                    b = 0.5 + 0.5 * sin(time + 4.188);

                    r2 = 0.5 + 0.5 * (sin(time * 0.4) * 0.8 + 0.2 * sin(time * 0.6));
                    g2 = 0.5 + 0.5 * (sin(time * 0.5) * 0.5 + 0.5 * sin(time * 0.4));
                    b2 = 0.5 + 0.5 * (sin(time * 0.2) * 0.6 + 0.4 * sin(time * 0.7));

                    rad = rad * (bass_att + mid_att + treb_att) / 3;
                }
            },
      },
        {
            enabled: 1,
            sides: 15,
            additive: 0,
            thickOutline: 0,
            textured: 0,
            x: 0.500000,
            y: 0.500000,
            rad: 0.100000,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 1.000000,
            r: 1.000000,
            g: 0.000000,
            b: 0.000000,
            a: 1.000000,
            r2: 0.000000,
            g2: 1.000000,
            b2: 1.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            per_frame_code: function (_) {
                with(_) {
                    x = 0.5 + 0.3 * (sin(time * 1.4) * 0.4 + 0.6 * sin(time * 1.9));
                    y = 0.5 + 0.5 * (sin(time * 1.2) * 0.7 + 0.3 * sin(time * 1.6));

                    r = 0.5 + 0.5 * sin(time);
                    g = 0.5 + 0.5 * sin(time + 2.094);
                    b = 0.5 + 0.5 * sin(time + 4.188);

                    r2 = 0.5 + 0.5 * (sin(time * 0.4) * 0.8 + 0.2 * sin(time * 0.6));
                    g2 = 0.5 + 0.5 * (sin(time * 0.5) * 0.5 + 0.5 * sin(time * 0.4));
                    b2 = 0.5 + 0.5 * (sin(time * 0.2) * 0.6 + 0.4 * sin(time * 0.7));

                    rad = rad * (bass_att + mid_att + treb_att) / 3;
                }
            },
      },
        {
            enabled: 1,
            sides: 15,
            additive: 0,
            thickOutline: 0,
            textured: 0,
            x: 0.500000,
            y: 0.500000,
            rad: 0.100000,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 1.000000,
            r: 1.000000,
            g: 0.000000,
            b: 0.000000,
            a: 1.000000,
            r2: 0.000000,
            g2: 1.000000,
            b2: 0.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            per_frame_code: function (_) {
                with(_) {
                    x = 0.5 + 0.5 * (sin(time * 1.4) * 0.4 + 0.6 * sin(time * 1.9));
                    y = 0.5 + 0.3 * (sin(time * 1.2) * 0.7 + 0.3 * sin(time * 1.6));

                    r = 0.5 + 0.5 * sin(time);
                    g = 0.5 + 0.5 * sin(time + 2.094);
                    b = 0.5 + 0.5 * sin(time + 4.188);

                    r2 = 0.5 + 0.5 * (sin(time * 0.4) * 0.8 + 0.2 * sin(time * 0.6));
                    g2 = 0.5 + 0.5 * (sin(time * 0.5) * 0.5 + 0.5 * sin(time * 0.4));
                    b2 = 0.5 + 0.5 * (sin(time * 0.2) * 0.6 + 0.4 * sin(time * 0.7));

                    rad = rad * (bass_att + mid_att + treb_att) / 3;
                }
            },
      },
        {
            enabled: 1,
            sides: 15,
            additive: 0,
            thickOutline: 0,
            textured: 0,
            x: 0.500000,
            y: 0.500000,
            rad: 0.100000,
            ang: 0.000000,
            tex_ang: 0.000000,
            tex_zoom: 1.000000,
            r: 1.000000,
            g: 0.000000,
            b: 0.000000,
            a: 1.000000,
            r2: 0.000000,
            g2: 1.000000,
            b2: 0.000000,
            a2: 0.000000,
            border_r: 1.000000,
            border_g: 1.000000,
            border_b: 1.000000,
            border_a: 0.000000,
            init_code: function (_) {
                with(_) {
                    set = rand(10);
                }
            },
            per_frame_code: function (_) {
                with(_) {
                    x = 0.5 + 0.3 * (sin(time * 1.4) * 0.4 + 0.6 * sin(time * 1.9));
                    y = 0.5 + 0.3 * (sin(time * 1.2) * 0.3 + 0.3 * sin(time * 1.6) + 0.4 * sin(time * (1 + set * 0.1)));

                    r = 0.6 + 0.4 * (sin(time * 0.3) * 0.8 + 0.2 * sin(time * 0.5));
                    g = 0.6 + 0.4 * (sin(time * 0.3) * 0.5 + 0.5 * sin(time * 0.4));
                    b = 0.6 + 0.4 * (sin(time * 0.6) * 0.6 + 0.4 * sin(time * 0.1));

                    r2 = 0.5 + 0.5 * (sin(time * 0.4) * 0.8 + 0.2 * sin(time * 0.6));
                    g2 = 0.5 + 0.5 * (sin(time * 0.5) * 0.5 + 0.5 * sin(time * 0.4));
                    b2 = 0.5 + 0.5 * (sin(time * 0.2) * 0.6 + 0.4 * sin(time * 0.7));

                    rad = rad * (bass_att + mid_att + treb_att) / 3;
                }
            },
      },
    ],
    waves: [
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
        {
            enabled: 0,
            samples: 512,
            sep: 0,
            bSpectrum: 0,
            bUseDots: 0,
            bDrawThick: 0,
            bAdditive: 0,
            scaling: 1.000000,
            smoothing: 0.500000,
            r: 1.000000,
            g: 1.000000,
            b: 1.000000,
            a: 1.000000,
      },
    ],
};

Presets["Rovastar - Torrid Tales.milk"] = {
    fRating: 3.0,
    fGammaAdj: 1.0,
    fDecay: 1.0,
    fVideoEchoZoom: 0.999609,
    fVideoEchoAlpha: 0.5,
    nVideoEchoOrientation: 1,
    nWaveMode: 8,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bWaveThick: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bRedBlueStereo: 0,
    bBrighten: 0,
    bDarken: 0,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 4.099998,
    fWaveScale: 1.285751,
    fWaveSmoothing: 0.63,
    fWaveParam: 0.0,
    fModWaveAlphaStart: 0.71,
    fModWaveAlphaEnd: 1.3,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.331,
    fZoomExponent: 1.0,
    fShader: 0.0,
    zoom: 0.990099,
    rot: 0.0,
    cx: 0.5,
    cy: 0.5,
    dx: 0.0,
    dy: 0.0,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.65,
    wave_g: 0.65,
    wave_b: 0.65,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.005,
    ob_r: 0.01,
    ob_g: 0.0,
    ob_b: 0.0,
    ob_a: 1.0,
    ib_size: 0.005,
    ib_r: 0.25,
    ib_g: 0.25,
    ib_b: 0.25,
    ib_a: 0.0,
    nMotionVectorsX: 64.0,
    nMotionVectorsY: 48.0,
    mv_dx: 0.0,
    mv_dy: 0.0,
    mv_l: 0.5,
    mv_r: 0.35,
    mv_g: 0.35,
    mv_b: 0.35,
    mv_a: 0.0,
    per_pixel_code: function (_) {
        with(_) {
            dx = sin((1000 + sin(q8)) / y) / 200;
            dy = cos((1000 + sin(q8)) / x) / 200;
            rot = dy * 100 * dx;
        }
    },
    init_code: function (_) {
        with(_) {
            q8 = 0;
            q1 = rand(2) + 2;
        }
    },
    per_frame_code: function (_) {
        with(_) {
            warp = 0;
            ib_r = 0.5 + 0.50 * (0.60 * sin(0.814 * time) + 0.40 * sin(1.011 * time));
            ib_g = 0.5 + 0.5 * sin(time * 1.476);
            ib_b = 0.5 + 0.5 * sin(1.374 * time);
            ob_r = ib_r;
            ob_g = ib_g;
            ob_b = ib_b;
            q8 = oldq8 + 0.001 * (pow(1 + 1.2 * bass + 0.4 * bass_att + 0.1 * treb + 0.1 * treb_att + 0.1 * mid + 0.1 * mid_att, 6) / fps);
            oldq8 = q8;
            wave_a = 0;
            ib_a = 1;
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

Presets["Unchained - Beat Demo 1.0.milk"] = {
    fRating: 3.0,
    fGammaAdj: 2.0,
    fDecay: 0.981,
    fVideoEchoZoom: 1.00644,
    fVideoEchoAlpha: 0.5,
    nVideoEchoOrientation: 3,
    nWaveMode: 5,
    bAdditiveWaves: 1,
    bWaveDots: 0,
    bModWaveAlphaByVolume: 0,
    bMaximizeWaveColor: 0,
    bTexWrap: 0,
    bDarkenCenter: 0,
    bMotionVectorsOn: 0,
    bRedBlueStereo: 0,
    nMotionVectorsX: 12,
    nMotionVectorsY: 9,
    bBrighten: 0,
    bDarken: 1,
    bSolarize: 0,
    bInvert: 0,
    fWaveAlpha: 1.868299,
    fWaveScale: 2.781641,
    fWaveSmoothing: 0.54,
    fWaveParam: 0.2,
    fModWaveAlphaStart: 0.95,
    fModWaveAlphaEnd: 0.75,
    fWarpAnimSpeed: 1.0,
    fWarpScale: 1.0,
    fZoomExponent: 1.008151,
    fShader: 0.2,
    zoom: 0.9998,
    rot: 0.0,
    cx: 0.47,
    cy: 0.5,
    dx: 0.005,
    dy: 0.0,
    warp: 0.01,
    sx: 1.0,
    sy: 1.0,
    wave_r: 0.5,
    wave_g: 0.5,
    wave_b: 0.5,
    wave_x: 0.5,
    wave_y: 0.5,
    ob_size: 0.0,
    ob_r: 0.5,
    ob_g: 0.5,
    ob_b: 0.5,
    ob_a: 0.0,
    ib_size: 0.0,
    ib_r: 0.5,
    ib_g: 0.5,
    ib_b: 0.5,
    ib_a: 0.0,
    per_frame_code: function (_) {
        with(_) {
            warp = 0;
            chaos = .9 + .1 * sin(pulse - beat);
            entropy = ifcond(bnot(entropy), 2, ifcond(equal(pulse, -20) * above(beat, 0), 1 + rand(5), entropy));
            bass_thresh = above(bass_att, bass_thresh) * 2 + (1 - above(bass_att, bass_thresh)) * ((bass_thresh - 1.3) * chaos + 1.3);
            bass_changed = abs(bass_changed - equal(bass_thresh, 2));
            treb_thresh = above(treb_att, treb_thresh) * 2 + (1 - above(treb_att, treb_thresh)) * ((treb_thresh - 1.3) * chaos + 1.3);
            treb_changed = abs(treb_changed - equal(treb_thresh, 2));
            mid_thresh = above(mid_att, mid_thresh) * 2 + (1 - above(mid_att, mid_thresh)) * ((mid_thresh - 1.3) * chaos + 1.3);
            mid_changed = abs(mid_changed - equal(mid_thresh, 2));
            pulse = ifcond(above(abs(pulse), 20), -20, pulse + (mid + bass + treb) * .025);
            beat = ifcond(above(abs(beat), 20), -20, beat + .1 * chaos * bor(bor(bass_changed, treb_changed), mid_changed));
            q3 = sin(pulse);
            q2 = sin(pulse + beat);
            q4 = sin(beat);
            q5 = entropy;
            q1 = (1 + 1 * above(q2, 0)) * (1 + 2 * above(q3, 0)) * (1 + 4 * mid_changed * above(q3, 0)) * (1 + 6 * above(q4, 0)) * (1 + 10 * bass_changed * above(q4, 0)) * (1 + 12 * above(q5, 3)) * (1 + 16 * treb_changed * above(q2, 0));
            wave_r = .5 + .2 * bnot(q1 % 2) - .2 * bnot(q1 % 3) + .3 * q3 * bnot(q1 % 13);
            wave_g = .5 + .2 * bnot(q1 % 5) - .2 * bnot(q1 % 13) + .3 * q4 * bnot(q1 % 7);
            wave_b = ifcond(bnot(q1 % 6), .8 + .2 * q4, .5 + .5 * q2);
            ob_r = ob_r + .2 * q2 + .3 * bnot(q1 % 13) * q3;
            ob_b = ob_b - .1 * bnot(q1 % 105) - .4 * q2;
            ob_g = ob_g + .5 * sin(pulse * .4 * entropy);
            ob_a = .07 + .05 * q3;
            ob_size = .01 * entropy * bnot(q1 % 6);
            ib_r = ib_r + .2 * q1 - .3 * bnot(q1 % 3) * q4;
            ib_b = ib_b - .2 * bnot(q1 % 17) - .3 * q2 + .2 * bnot(q1 % 11);
            ib_g = ib_g + .5 * sin(pulse * .35 * entropy);
            ib_a = .07 + .05 * q3 * q4;
            ib_size = .005 + .005 * q3;
            zoom_fade = ifcond(bnot(q1 % 2), zoom_fade - (zoom_fade - .97) / 2, zoom_fade - bnot(q1 % 5) * .02 * q4 + bnot(q1 % 2) * .02 * q3 - bnot(q1 % 11) * .04 * q2);
            zoom = zoom_fade;
            rot_fade = ifcond(bnot(q1 % 7), rot_fade - (rot_fade - .1 * q3) / 2 - .03 * bnot(q1 % 13), rot_fade - .02 * bnot(q1 % 11) + .02 * bnot(q1 % 3) + .03 * bnot(q1 % 35));
            rot = rot_fade;
            cx = cx + .1 * bnot(q1 % 39) + .07 * bnot(q1 % 13) * q3 - .2 * bnot(q1 % 55) * q4;
            wave_x = wave_x + .1 * q3 + .2 * q4 * bnot(q1 % 2);
        }
    },
    shapes: [
    ],
    waves: [
    ],
};

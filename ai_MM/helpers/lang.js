/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';

/*
    Adds methods for converting Wikipedia ISO 639 language code to language name or native name
    There are some differences between the ISO mappings and Wikipedia codes, we use Wikipedia notation
*/

var isoLangs = {
    'ab': {
        name: 'Abkhazian',
        nativeName: 'Аҧсшәа'
    },
    'ace': {
        name: 'Acehnese',
        nativeName: 'Acèh'
    },
    'af': {
        name: 'Afrikaans',
        nativeName: 'Afrikaans'
    },
    'ak': {
        name: 'Akan',
        nativeName: 'Akan'
    },
    'als': {
        name: 'Alemannic',
        nativeName: 'Alemannisch'
    },
    'am': {
        name: 'Amharic',
        nativeName: 'አማርኛ'
    },
    'an': {
        name: 'Aragonese',
        nativeName: 'aragonés'
    },
    'ang': {
        name: 'Anglo-Saxon',
        nativeName: 'Ænglisc'
    },
    'ar': {
        name: 'Arabic',
        nativeName: 'العربية'
    },
    'arc': {
        name: 'Aramaic',
        nativeName: 'ܐܪܡܝܐ'
    },
    'arz': {
        name: 'Egyptian Arabic',
        nativeName: 'مصرى'
    },
    'as': {
        name: 'Assamese',
        nativeName: 'অসমীয়া'
    },
    'ast': {
        name: 'Asturian',
        nativeName: 'asturianu'
    },
    'av': {
        name: 'Avar',
        nativeName: 'авар'
    },
    'ay': {
        name: 'Aymara',
        nativeName: 'Aymar aru'
    },
    'az': {
        name: 'Azerbaijani',
        nativeName: 'azərbaycanca'
    },
    'azb': {
        name: 'Southern Azerbaijani',
        nativeName: 'تۆرکجه'
    },
    'ba': {
        name: 'Bashkir',
        nativeName: 'башҡортса'
    },
    'bar': {
        name: 'Bavarian',
        nativeName: 'Boarisch'
    },
    'bat_smg': {
        name: 'Samogitian',
        nativeName: 'žemaitėška'
    },
    'bcl': {
        name: 'Central Bicolano',
        nativeName: 'Bikol Central'
    },
    'be': {
        name: 'Belarusian',
        nativeName: 'беларуская'
    },
    'be_x_old': {
        name: 'Belarusian (Taraškievica)',
        nativeName: 'беларуская (тарашкевіца)'
    },
    'bg': {
        name: 'Bulgarian',
        nativeName: 'български'
    },
    'bh': {
        name: 'Bihari',
        nativeName: 'भोजपुरी'
    },
    'bi': {
        name: 'Bislama',
        nativeName: 'Bislama'
    },
    'bjn': {
        name: 'Banjar',
        nativeName: 'Bahasa Banjar'
    },
    'bm': {
        name: 'Bambara',
        nativeName: 'bamanankan'
    },
    'bn': {
        name: 'Bengali',
        nativeName: 'বাংলা'
    },
    'bo': {
        name: 'Tibetan',
        nativeName: 'བོད་ཡིག'
    },
    'bpy': {
        name: 'Bishnupriya Manipuri',
        nativeName: 'বিষ্ণুপ্রিয়া মণিপুরী'
    },
    'br': {
        name: 'Breton',
        nativeName: 'brezhoneg'
    },
    'bs': {
        name: 'Bosnian',
        nativeName: 'bosanski'
    },
    'bug': {
        name: 'Buginese',
        nativeName: 'ᨅᨔ ᨕᨘᨁᨗ'
    },
    'bxr': {
        name: 'Buryat',
        nativeName: 'буряад'
    },
    'ca': {
        name: 'Catalan',
        nativeName: 'català'
    },
    'cbk_zam': {
        name: 'Chavacano',
        nativeName: 'Chavacano de Zamboanga'
    },
    'cdo': {
        name: 'Min Dong',
        nativeName: 'Mìng-dĕ̤ng-ngṳ̄'
    },
    'ce': {
        name: 'Chechen',
        nativeName: 'нохчийн'
    },
    'ceb': {
        name: 'Cebuano',
        nativeName: 'Cebuano'
    },
    'ch': {
        name: 'Chamorro',
        nativeName: 'Chamoru'
    },
    'chr': {
        name: 'Cherokee',
        nativeName: 'ᏣᎳᎩ'
    },
    'chy': {
        name: 'Cheyenne',
        nativeName: 'Tsetsêhestâhese'
    },
    'ckb': {
        name: 'Sorani',
        nativeName: 'کوردیی ناوەندی'
    },
    'co': {
        name: 'Corsican',
        nativeName: 'corsu'
    },
    'cr': {
        name: 'Cree',
        nativeName: 'Nēhiyawēwin / ᓀᐦᐃᔭᐍᐏᐣ'
    },
    'crh': {
        name: 'Crimean Tatar',
        nativeName: 'qırımtatarca'
    },
    'cs': {
        name: 'Czech',
        nativeName: 'čeština'
    },
    'csb': {
        name: 'Kashubian',
        nativeName: 'kaszëbsczi'
    },
    'cu': {
        name: 'Old Church Slavonic',
        nativeName: 'словѣньскъ / ⰔⰎⰑⰂⰡⰐⰠⰔⰍⰟ'
    },
    'cv': {
        name: 'Chuvash',
        nativeName: 'Чӑвашла'
    },
    'cy': {
        name: 'Welsh',
        nativeName: 'Cymraeg'
    },
    'da': {
        name: 'Danish',
        nativeName: 'dansk'
    },
    'de': {
        name: 'German',
        nativeName: 'Deutsch'
    },
    'diq': {
        name: 'Zazaki',
        nativeName: 'Zazaki'
    },
    'dsb': {
        name: 'Lower Sorbian',
        nativeName: 'dolnoserbski'
    },
    'dv': {
        name: 'Divehi',
        nativeName: 'ދިވެހިބަސް'
    },
    'dz': {
        name: 'Dzongkha',
        nativeName: 'ཇོང་ཁ'
    },
    'ee': {
        name: 'Ewe',
        nativeName: 'eʋegbe'
    },
    'el': {
        name: 'Greek',
        nativeName: 'Ελληνικά'
    },
    'eml': {
        name: 'Emilian-Romagnol',
        nativeName: 'emiliàn e rumagnòl'
    },
    'en': {
        name: 'English',
        nativeName: 'English'
    },
    'eo': {
        name: 'Esperanto',
        nativeName: 'Esperanto'
    },
    'es': {
        name: 'Spanish',
        nativeName: 'español'
    },
    'et': {
        name: 'Estonian',
        nativeName: 'eesti'
    },
    'eu': {
        name: 'Basque',
        nativeName: 'euskara'
    },
    'ext': {
        name: 'Extremaduran',
        nativeName: 'estremeñu'
    },
    'fa': {
        name: 'Persian',
        nativeName: 'فارسی'
    },
    'ff': {
        name: 'Fula',
        nativeName: 'Fulfulde'
    },
    'fi': {
        name: 'Finnish',
        nativeName: 'suomi'
    },
    'fiu_vro': {
        name: 'Võro',
        nativeName: 'Võro'
    },
    'fj': {
        name: 'Fijian',
        nativeName: 'Na Vosa Vakaviti'
    },
    'fo': {
        name: 'Faroese',
        nativeName: 'føroyskt'
    },
    'fr': {
        name: 'French',
        nativeName: 'français'
    },
    'frp': {
        name: 'Franco-Provençal',
        nativeName: 'arpetan'
    },
    'frr': {
        name: 'North Frisian',
        nativeName: 'Nordfriisk'
    },
    'fur': {
        name: 'Friulian',
        nativeName: 'furlan'
    },
    'fy': {
        name: 'West Frisian',
        nativeName: 'Frysk'
    },
    'ga': {
        name: 'Irish',
        nativeName: 'Gaeilge'
    },
    'gag': {
        name: 'Gagauz',
        nativeName: 'Gagauz'
    },
    'gan': {
        name: 'Gan',
        nativeName: '贛語'
    },
    'gd': {
        name: 'Scottish Gaelic',
        nativeName: 'Gàidhlig'
    },
    'gl': {
        name: 'Galician',
        nativeName: 'galego'
    },
    'glk': {
        name: 'Gilaki',
        nativeName: 'گیلکی'
    },
    'gn': {
        name: 'Guarani',
        nativeName: 'Avañe\'ẽ'
    },
    'gom': {
        name: 'Goan Konkani',
        nativeName: 'गोवा कोंकणी / Gova Konknni'
    },
    'got': {
        name: 'Gothic',
        nativeName: '𐌲𐌿𐍄𐌹𐍃𐌺'
    },
    'gu': {
        name: 'Gujarati',
        nativeName: 'ગુજરાતી'
    },
    'gv': {
        name: 'Manx',
        nativeName: 'Gaelg'
    },
    'ha': {
        name: 'Hausa',
        nativeName: 'Hausa'
    },
    'hak': {
        name: 'Hakka',
        nativeName: '客家語/Hak-kâ-ngî'
    },
    'haw': {
        name: 'Hawaiian',
        nativeName: 'Hawai`i'
    },
    'he': {
        name: 'Hebrew',
        nativeName: 'עברית'
    },
    'hi': {
        name: 'Hindi',
        nativeName: 'हिन्दी'
    },
    'hif': {
        name: 'Fiji Hindi',
        nativeName: 'Fiji Hindi'
    },
    'hr': {
        name: 'Croatian',
        nativeName: 'hrvatski'
    },
    'hsb': {
        name: 'Upper Sorbian',
        nativeName: 'hornjoserbsce'
    },
    'ht': {
        name: 'Haitian',
        nativeName: 'Kreyòl ayisyen'
    },
    'hu': {
        name: 'Hungarian',
        nativeName: 'magyar'
    },
    'hy': {
        name: 'Armenian',
        nativeName: 'Հայերեն'
    },
    'ia': {
        name: 'Interlingua',
        nativeName: 'interlingua'
    },
    'id': {
        name: 'Indonesian',
        nativeName: 'Bahasa Indonesia'
    },
    'ie': {
        name: 'Interlingue',
        nativeName: 'Interlingue'
    },
    'ig': {
        name: 'Igbo',
        nativeName: 'Igbo'
    },
    'ik': {
        name: 'Inupiak',
        nativeName: 'Iñupiak'
    },
    'ilo': {
        name: 'Ilokano',
        nativeName: 'Ilokano'
    },
    'io': {
        name: 'Ido',
        nativeName: 'Ido'
    },
    'is': {
        name: 'Icelandic',
        nativeName: 'íslenska'
    },
    'it': {
        name: 'Italian',
        nativeName: 'italiano'
    },
    'iu': {
        name: 'Inuktitut',
        nativeName: 'ᐃᓄᒃᑎᑐᑦ/inuktitut'
    },
    'ja': {
        name: 'Japanese',
        nativeName: '日本語'
    },
    'jbo': {
        name: 'Lojban',
        nativeName: 'Lojban'
    },
    'jv': {
        name: 'Javanese',
        nativeName: 'Basa Jawa'
    },
    'ka': {
        name: 'Georgian',
        nativeName: 'ქართული'
    },
    'kaa': {
        name: 'Karakalpak',
        nativeName: 'Qaraqalpaqsha'
    },
    'kab': {
        name: 'Kabyle',
        nativeName: 'Taqbaylit'
    },
    'kbd': {
        name: 'Kabardian',
        nativeName: 'Адыгэбзэ'
    },
    'kg': {
        name: 'Kongo',
        nativeName: 'Kongo'
    },
    'ki': {
        name: 'Kikuyu',
        nativeName: 'Gĩkũyũ'
    },
    'kk': {
        name: 'Kazakh',
        nativeName: 'қазақша'
    },
    'kl': {
        name: 'Greenlandic',
        nativeName: 'kalaallisut'
    },
    'km': {
        name: 'Khmer',
        nativeName: 'ភាសាខ្មែរ'
    },
    'kn': {
        name: 'Kannada',
        nativeName: 'ಕನ್ನಡ'
    },
    'ko': {
        name: 'Korean',
        nativeName: '한국어'
    },
    'koi': {
        name: 'Komi-Permyak',
        nativeName: 'Перем Коми'
    },
    'krc': {
        name: 'Karachay-Balkar',
        nativeName: 'къарачай-малкъар'
    },
    'ks': {
        name: 'Kashmiri',
        nativeName: 'कॉशुर / کٲشُر'
    },
    'ksh': {
        name: 'Ripuarian',
        nativeName: 'Ripoarisch'
    },
    'ku': {
        name: 'Kurdish',
        nativeName: 'Kurdî'
    },
    'kv': {
        name: 'Komi',
        nativeName: 'коми'
    },
    'kw': {
        name: 'Cornish',
        nativeName: 'kernowek'
    },
    'ky': {
        name: 'Kirghiz',
        nativeName: 'Кыргызча'
    },
    'la': {
        name: 'Latin',
        nativeName: 'Latina'
    },
    'lad': {
        name: 'Ladino',
        nativeName: 'Ladino'
    },
    'lb': {
        name: 'Luxembourgish',
        nativeName: 'Lëtzebuergesch'
    },
    'lbe': {
        name: 'Lak',
        nativeName: 'лакку'
    },
    'lez': {
        name: 'Lezgian',
        nativeName: 'лезги'
    },
    'lg': {
        name: 'Luganda',
        nativeName: 'Luganda'
    },
    'li': {
        name: 'Limburgish',
        nativeName: 'Limburgs'
    },
    'lij': {
        name: 'Ligurian',
        nativeName: 'Ligure'
    },
    'lmo': {
        name: 'Lombard',
        nativeName: 'lumbaart'
    },
    'ln': {
        name: 'Lingala',
        nativeName: 'lingála'
    },
    'lo': {
        name: 'Lao',
        nativeName: 'ລາວ'
    },
    'lrc': {
        name: 'Northern Luri',
        nativeName: 'لۊری شومالی'
    },
    'lt': {
        name: 'Lithuanian',
        nativeName: 'lietuvių'
    },
    'ltg': {
        name: 'Latgalian',
        nativeName: 'latgaļu'
    },
    'lv': {
        name: 'Latvian',
        nativeName: 'latviešu'
    },
    'mai': {
        name: 'Maithili',
        nativeName: 'मैथिली'
    },
    'map_bms': {
        name: 'Banyumasan',
        nativeName: 'Basa Banyumasan'
    },
    'mdf': {
        name: 'Moksha',
        nativeName: 'мокшень'
    },
    'mg': {
        name: 'Malagasy',
        nativeName: 'Malagasy'
    },
    'mhr': {
        name: 'Meadow Mari',
        nativeName: 'олык марий'
    },
    'mi': {
        name: 'Maori',
        nativeName: 'Māori'
    },
    'min': {
        name: 'Minangkabau',
        nativeName: 'Baso Minangkabau'
    },
    'mk': {
        name: 'Macedonian',
        nativeName: 'македонски'
    },
    'ml': {
        name: 'Malayalam',
        nativeName: 'മലയാളം'
    },
    'mn': {
        name: 'Mongolian',
        nativeName: 'монгол'
    },
    'mr': {
        name: 'Marathi',
        nativeName: 'मराठी'
    },
    'mrj': {
        name: 'Hill Mari',
        nativeName: 'кырык мары'
    },
    'ms': {
        name: 'Malay',
        nativeName: 'Bahasa Melayu'
    },
    'mt': {
        name: 'Maltese',
        nativeName: 'Malti'
    },
    'mwl': {
        name: 'Mirandese',
        nativeName: 'Mirandés'
    },
    'my': {
        name: 'Burmese',
        nativeName: 'မြန်မာဘာသာ'
    },
    'myv': {
        name: 'Erzya',
        nativeName: 'эрзянь'
    },
    'mzn': {
        name: 'Mazandarani',
        nativeName: 'مازِرونی'
    },
    'na': {
        name: 'Nauruan',
        nativeName: 'Dorerin Naoero'
    },
    'nah': {
        name: 'Nahuatl',
        nativeName: 'Nāhuatl'
    },
    'nap': {
        name: 'Neapolitan',
        nativeName: 'Napulitano'
    },
    'nds': {
        name: 'Low Saxon',
        nativeName: 'Plattdüütsch'
    },
    'nds_nl': {
        name: 'Dutch Low Saxon',
        nativeName: 'Nedersaksies'
    },
    'ne': {
        name: 'Nepali',
        nativeName: 'नेपाली'
    },
    'new': {
        name: 'Newar',
        nativeName: 'नेपाल भाषा'
    },
    'nl': {
        name: 'Dutch',
        nativeName: 'Nederlands'
    },
    'nn': {
        name: 'Norwegian (Nynorsk)',
        nativeName: 'norsk nynorsk'
    },
    'no': {
        name: 'Norwegian (Bokmål)',
        nativeName: 'norsk bokmål'
    },
    'nov': {
        name: 'Novial',
        nativeName: 'Novial'
    },
    'nrm': {
        name: 'Norman',
        nativeName: 'Nouormand'
    },
    'nso': {
        name: 'Northern Sotho',
        nativeName: 'Sesotho sa Leboa'
    },
    'nv': {
        name: 'Navajo',
        nativeName: 'Diné bizaad'
    },
    'ny': {
        name: 'Chichewa',
        nativeName: 'Chi-Chewa'
    },
    'oc': {
        name: 'Occitan',
        nativeName: 'occitan'
    },
    'om': {
        name: 'Oromo',
        nativeName: 'Oromoo'
    },
    'or': {
        name: 'Oriya',
        nativeName: 'ଓଡ଼ିଆ'
    },
    'os': {
        name: 'Ossetian',
        nativeName: 'Ирон'
    },
    'pa': {
        name: 'Punjabi',
        nativeName: 'ਪੰਜਾਬੀ'
    },
    'pag': {
        name: 'Pangasinan',
        nativeName: 'Pangasinan'
    },
    'pam': {
        name: 'Kapampangan',
        nativeName: 'Kapampangan'
    },
    'pap': {
        name: 'Papiamentu',
        nativeName: 'Papiamentu'
    },
    'pcd': {
        name: 'Picard',
        nativeName: 'Picard'
    },
    'pdc': {
        name: 'Pennsylvania German',
        nativeName: 'Deitsch'
    },
    'pfl': {
        name: 'Palatinate German',
        nativeName: 'Pälzisch'
    },
    'pi': {
        name: 'Pali',
        nativeName: 'पालि'
    },
    'pih': {
        name: 'Norfolk',
        nativeName: 'Norfuk / Pitkern'
    },
    'pl': {
        name: 'Polish',
        nativeName: 'polski'
    },
    'pms': {
        name: 'Piedmontese',
        nativeName: 'Piemontèis'
    },
    'pnb': {
        name: 'Western Punjabi',
        nativeName: 'پنجابی'
    },
    'pnt': {
        name: 'Pontic',
        nativeName: 'Ποντιακά'
    },
    'ps': {
        name: 'Pashto',
        nativeName: 'پښتو'
    },
    'pt': {
        name: 'Portuguese',
        nativeName: 'português'
    },
    'qu': {
        name: 'Quechua',
        nativeName: 'Runa Simi'
    },
    'rm': {
        name: 'Romansh',
        nativeName: 'rumantsch'
    },
    'rmy': {
        name: 'Romani',
        nativeName: 'Romani'
    },
    'rn': {
        name: 'Kirundi',
        nativeName: 'Kirundi'
    },
    'ro': {
        name: 'Romanian',
        nativeName: 'română'
    },
    'roa_rup': {
        name: 'Aromanian',
        nativeName: 'armãneashti'
    },
    'roa_tara': {
        name: 'Tarantino',
        nativeName: 'tarandíne'
    },
    'ru': {
        name: 'Russian',
        nativeName: 'русский'
    },
    'rue': {
        name: 'Rusyn',
        nativeName: 'русиньскый'
    },
    'rw': {
        name: 'Kinyarwanda',
        nativeName: 'Kinyarwanda'
    },
    'sa': {
        name: 'Sanskrit',
        nativeName: 'संस्कृतम्'
    },
    'sah': {
        name: 'Sakha',
        nativeName: 'саха тыла'
    },
    'sc': {
        name: 'Sardinian',
        nativeName: 'sardu'
    },
    'scn': {
        name: 'Sicilian',
        nativeName: 'sicilianu'
    },
    'sco': {
        name: 'Scots',
        nativeName: 'Scots'
    },
    'sd': {
        name: 'Sindhi',
        nativeName: 'سنڌي'
    },
    'se': {
        name: 'Northern Sami',
        nativeName: 'sámegiella'
    },
    'sg': {
        name: 'Sango',
        nativeName: 'Sängö'
    },
    'sh': {
        name: 'Serbo-Croatian',
        nativeName: 'srpskohrvatski / српскохрватски'
    },
    'si': {
        name: 'Sinhalese',
        nativeName: 'සිංහල'
    },
    'simple': {
        name: 'Simple English',
        nativeName: 'Simple English'
    },
    'sk': {
        name: 'Slovak',
        nativeName: 'slovenčina'
    },
    'sl': {
        name: 'Slovenian',
        nativeName: 'slovenščina'
    },
    'sm': {
        name: 'Samoan',
        nativeName: 'Gagana Samoa'
    },
    'sn': {
        name: 'Shona',
        nativeName: 'chiShona'
    },
    'so': {
        name: 'Somali',
        nativeName: 'Soomaaliga'
    },
    'sq': {
        name: 'Albanian',
        nativeName: 'shqip'
    },
    'sr': {
        name: 'Serbian',
        nativeName: 'српски / srpski'
    },
    'srn': {
        name: 'Sranan',
        nativeName: 'Sranantongo'
    },
    'ss': {
        name: 'Swati',
        nativeName: 'SiSwati'
    },
    'st': {
        name: 'Sesotho',
        nativeName: 'Sesotho'
    },
    'stq': {
        name: 'Saterland Frisian',
        nativeName: 'Seeltersk'
    },
    'su': {
        name: 'Sundanese',
        nativeName: 'Basa Sunda'
    },
    'sv': {
        name: 'Swedish',
        nativeName: 'svenska'
    },
    'sw': {
        name: 'Swahili',
        nativeName: 'Kiswahili'
    },
    'szl': {
        name: 'Silesian',
        nativeName: 'ślůnski'
    },
    'ta': {
        name: 'Tamil',
        nativeName: 'தமிழ்'
    },
    'te': {
        name: 'Telugu',
        nativeName: 'తెలుగు'
    },
    'tet': {
        name: 'Tetum',
        nativeName: 'tetun'
    },
    'tg': {
        name: 'Tajik',
        nativeName: 'тоҷикӣ'
    },
    'th': {
        name: 'Thai',
        nativeName: 'ไทย'
    },
    'ti': {
        name: 'Tigrinya',
        nativeName: 'ትግርኛ'
    },
    'tk': {
        name: 'Turkmen',
        nativeName: 'Türkmençe'
    },
    'tl': {
        name: 'Tagalog',
        nativeName: 'Tagalog'
    },
    'tn': {
        name: 'Tswana',
        nativeName: 'Setswana'
    },
    'to': {
        name: 'Tongan',
        nativeName: 'lea faka-Tonga'
    },
    'tpi': {
        name: 'Tok Pisin',
        nativeName: 'Tok Pisin'
    },
    'tr': {
        name: 'Turkish',
        nativeName: 'Türkçe'
    },
    'ts': {
        name: 'Tsonga',
        nativeName: 'Xitsonga'
    },
    'tt': {
        name: 'Tatar',
        nativeName: 'татарча/tatarça'
    },
    'tum': {
        name: 'Tumbuka',
        nativeName: 'chiTumbuka'
    },
    'tw': {
        name: 'Twi',
        nativeName: 'Twi'
    },
    'ty': {
        name: 'Tahitian',
        nativeName: 'reo tahiti'
    },
    'tyv': {
        name: 'Tuvan',
        nativeName: 'тыва дыл'
    },
    'udm': {
        name: 'Udmurt',
        nativeName: 'удмурт'
    },
    'ug': {
        name: 'Uyghur',
        nativeName: 'ئۇيغۇرچە / Uyghurche'
    },
    'uk': {
        name: 'Ukrainian',
        nativeName: 'українська'
    },
    'ur': {
        name: 'Urdu',
        nativeName: 'اردو'
    },
    'uz': {
        name: 'Uzbek',
        nativeName: 'oʻzbekcha/ўзбекча'
    },
    've': {
        name: 'Venda',
        nativeName: 'Tshivenda'
    },
    'vec': {
        name: 'Venetian',
        nativeName: 'vèneto'
    },
    'vep': {
        name: 'Vepsian',
        nativeName: 'vepsän kel’'
    },
    'vi': {
        name: 'Vietnamese',
        nativeName: 'Tiếng Việt'
    },
    'vls': {
        name: 'West Flemish',
        nativeName: 'West-Vlams'
    },
    'vo': {
        name: 'Volapük',
        nativeName: 'Volapük'
    },
    'wa': {
        name: 'Walloon',
        nativeName: 'walon'
    },
    'war': {
        name: 'Waray-Waray',
        nativeName: 'Winaray'
    },
    'wo': {
        name: 'Wolof',
        nativeName: 'Wolof'
    },
    'wuu': {
        name: 'Wu',
        nativeName: '吴语'
    },
    'xal': {
        name: 'Kalmyk',
        nativeName: 'хальмг'
    },
    'xh': {
        name: 'Xhosa',
        nativeName: 'isiXhosa'
    },
    'xmf': {
        name: 'Mingrelian',
        nativeName: 'მარგალური'
    },
    'yi': {
        name: 'Yiddish',
        nativeName: 'ייִדיש'
    },
    'yo': {
        name: 'Yoruba',
        nativeName: 'Yorùbá'
    },
    'za': {
        name: 'Zhuang',
        nativeName: 'Vahcuengh'
    },
    'zea': {
        name: 'Zeelandic',
        nativeName: 'Zeêuws'
    },
    'zh': {
        name: 'Chinese',
        nativeName: '中文'
    },
    'zh_classical': {
        name: 'Classical Chinese',
        nativeName: '文言'
    },
    'zh_min_nan': {
        name: 'Min Nan',
        nativeName: 'Bân-lâm-gú'
    },
    'zh_yue': {
        name: 'Cantonese',
        nativeName: '粵語'
    },
    'zu': {
        name: 'Zulu',
        nativeName: 'isiZulu'
    }
}

// Note: Added in 5.0.2
window.getLanguageName = function (key) {
    var lang = isoLangs[key];
    return lang ? lang.name : key;
}

// Note: Added in 5.0.2
window.getLanguageNativeName = function (key) {
    var lang = isoLangs[key];
    if (lang) { // capitalize first letter
        return lang.nativeName.charAt(0).toUpperCase() + lang.nativeName.slice(1);
    } else
        return key; // unknown code
}
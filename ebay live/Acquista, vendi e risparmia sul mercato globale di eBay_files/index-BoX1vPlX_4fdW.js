
/**
* Reads and writes cookies for Marketplace domain page.
* <p>
* Note: This class is only used for eBay site.
*
*/

'use strict';

var DEFAULT_COOKIE_FORMAT = {
        "COOKIELET_DELIMITER":"^",
        "NAME_VALUE_DELIMITER":"/",
        "escapedValue":true
    },
    DP_COOKIE_FORMAT = { // FORMAT: delim-persist
        "COOKIELET_DELIMITER":"^",
        "NAME_VALUE_DELIMITER":"/",
        "bUseExp":true,
        "startDelim":"b"
    },
    SESSION_COOKIE_FORMAT = { // FORMAT: delimited
        "COOKIELET_DELIMITER":"^",
        "NAME_VALUE_DELIMITER":"=",
        "escapedValue":true,
        "startDelim":"^"
    },
    DS_COOKIE_FORMAT = { // FORMAT: delim-session
        "COOKIELET_DELIMITER":"^",
        "NAME_VALUE_DELIMITER":"/"
    },
    sPath = "/",
    aConversionMap = {
        'reg': ['dp1', 'reg'],
        'recent_vi': ['ebay', 'lvmn'],
        'ebaysignin': ['ebay', 'sin'],
        'p': ['dp1', 'p'],
        'etfc': ['dp1', 'etfc'],
        'keepmesignin': ['dp1', 'kms'],
        'ItemList': ['ebay', 'wl'],
        'BackToList': ['s', 'BIBO_BACK_TO_LIST']
    },
    aFormatMap = {
        'r': DEFAULT_COOKIE_FORMAT,
        'dp1': DP_COOKIE_FORMAT,
        'npii': DP_COOKIE_FORMAT,
        'ebay': SESSION_COOKIE_FORMAT,
        'reg': SESSION_COOKIE_FORMAT,
        'apcCookies': SESSION_COOKIE_FORMAT,
        'ds2': DS_COOKIE_FORMAT
    },
    sCOMPAT = "10",
    sCONVER = "01",
    sSTRICT = "00",

    sModesCookie = "ebay",
    sModesCookielet = "cv";

var api = {
    /**
    * Gets the value of the given cookielet from a specified cookie.
    *
    * @param {String} cookie
    *        a string name of the cookie
    * @param {String} cookielet
    *        a string name of the cookielet in the specified cookie
    * @return {String}
    *        the value of the cookielet
    */
    //>public String readCookie(String,String);
    readCookie: function(psCookie, psCookielet) {
        var rv = this.readCookieObj(psCookie, psCookielet).value;
        if (!rv) {
            return '';
        }
        var format = this.getFormat(psCookie);
        if (format.escapedValue) {
            rv = decodeURIComponent(rv);
        }
        return rv;
    },

    // Provide async version of readCookie using cookieStore API
    async readCookieAsync(psCookie, psCookielet) {
        // Check if cookieStore API is available in the browser, if not use the traditional way of reading cookies
        if(!this.isCookieStoreAvialable()) {
            return this.readCookie(psCookie, psCookielet);
        }

        var cookie = await this.readCookieObjAsync(psCookie, psCookielet);
        var rv = cookie.value;
        if (!rv) {
            return '';
        }
        var format = this.getFormat(psCookie);
        if (format.escapedValue) {
            rv = decodeURIComponent(rv);
        }
        return rv;
    },

    //>private Object createDefaultCookieBean(String, String);
    createDefaultCookieBean: function(psCookie, psCookielet) {
        // define cookie bean
        var cookie = {};
        // string
        cookie.name = psCookie;
        // string
        cookie.cookieletname = psCookielet;
        // string
        cookie.value = "";
        // date in millisecs UTC
        cookie.maxage = 0;
        cookie.rawcookievalue = "";
        cookie.mode = "";
        return cookie;
    },

    readCookieObjCommon: function(cookie) {
        this.checkConversionMap(cookie);

        // returns the raw value of the cookie from document.cookie
        // raw value
        cookie.rawcookievalue = this.aCookies[cookie.name];

        // TODO - determine why this is required
        if (!cookie.name || !cookie.rawcookievalue) {
            cookie.value = "";
        }
        else if (!cookie.cookieletname) {
            // read cookie
            this.readCookieInternal(cookie);
        }
        else {
            // read cookielet
            this.readCookieletInternal(cookie);
        }

        // Check cookie corruption
        var guid = (cookie.cookieletname && cookie.cookieletname.match(/guid$/));
        var object = (typeof cookie !== 'undefined') ? cookie : '';

        var corrupted = (object && guid && (cookie.value.length > 32));
        if (corrupted) {
            cookie.value = cookie.value.substring(0, 32);
        }

        return object;
    },

    readCookieObjAsync: async function(psCookie, psCookielet) {
        var cookie = this.createDefaultCookieBean(psCookie, psCookielet);
        await this.updateAsync();
        return this.readCookieObjCommon(cookie);
    },

    readCookieObj: function(psCookie, psCookielet) {
        var cookie = this.createDefaultCookieBean(psCookie, psCookielet);
        this.update();
        return this.readCookieObjCommon(cookie);
    },

    //> private void checkConversionMap(Object);
    checkConversionMap: function(cookie) {
        //Check conversion map
        // 2 values returned - 2 values cookie + cookielet
        var cmap = aConversionMap[cookie.name];

        // if cookielet is in conversio map then do the following
        // reset cookie and cookielet names to old namesl
        /*
                raw cookies are being converted to cookielets
                this takes care of the moving cookies to cookielets
        */

        if (cmap) {
            // compatibility mode
            cookie.mode = this.getMode(cookie.name);
            cookie.name = cmap[0];
            cookie.cookieletname = cmap[1];
        }
    },

    //> private Object readCookieInternal(Object);
    readCookieInternal: function(cookie) {
        // read raw cookie with compatibility modes to switch between raw cookie and cookielets
        cookie.value  = cookie.rawcookievalue;
        return cookie;
    },

    //> private Object readCookieletInternal(Object);
    readCookieletInternal: function(cookie) {
        var clet = this.getCookielet(cookie.name, cookie.cookieletname, cookie.rawcookievalue);
        // handling formats of cookielets mentiond in aFormatMap
        var format = this.getFormat(cookie.name);
        if (clet && format.bUseExp) {
            //do not expire cookie on client
            var cletOrig = clet;
            clet = clet.substring(0, clet.length - 8);
            if (cletOrig.length > 8) {
                cookie.maxage = cletOrig.substring(cletOrig.length - 8);
            }
        }

        // All other modes and if mode is not available
        cookie.value = clet;
        // COMPAT mode
        if (cookie.mode == sCOMPAT) { // jshint ignore:line
            cookie.value = cookie.rawcookievalue;
        }
        return cookie;
    },

    /**
    * Gets multiple values from a cookielet. This function splits a cookielet
    * value by predefined delimiter and construct an array stores each value.
    *
    * @param {String} cookie
    *        a string name of the cookie
    * @param {String} cookielet
    *        a string name of the cookielet in the specified cookie
    * @return {Object}
    *        an array that stores the multiples value
    */
    //> public Object readMultiLineCookie(String,String);
    readMultiLineCookie: function(psCookie, psCookielet) { // jshint ignore:line
        //this.update();
        if (!psCookie || !psCookielet) {
            return "";
        }
        var val, r = "";
        var cmap = aConversionMap[psCookie];
        if (cmap) {
            val = this.readCookieObj(cmap[0], cmap[1]).value || "";
        }
        if (val) {
            r = this.getCookielet(psCookie, psCookielet, val) || "";
        }
        return (typeof r !== "undefined") ? r : "";
    },

    readMultiLineCookieAsync: async function(psCookie, psCookielet) {
        //this.update();
        if (!psCookie || !psCookielet) {
            return "";
        }
        var val, r = "";
        var cmap = aConversionMap[psCookie];
        if (cmap) {
            val = await this.readCookieObjAsync(cmap[0], cmap[1]).value || "";
        }
        if (val) {
            r = this.getCookielet(psCookie, psCookielet, val) || "";
        }
        return (typeof r !== "undefined") ? r : "";
    },

    /**
    * Writes a value String to a given cookie. This function requires setting
    * an exact expire date. You can use {@link writeCookieEx} instead to set
    * the days that the cookie will be avaliable.
    *
    * @param {String} cookie
    *        a string name of the cookie to be written
    * @param {String} value
    *        a string value to be written in cookie
    * @param {String} exp
    *        an exact expired date of the cookie
    * @see #writeCookieEx
    */
    //> public void writeCookie(String,String,String);
    //> public void writeCookie(String,String,int);
    writeCookie: function(psCookie, psVal, psExp) {
        //@param    pbSecure - secured? (optional)
        //Check conversion map
        var cmap = aConversionMap[psCookie];
        if (cmap) {
            this.writeCookielet(cmap[0], cmap[1], psVal, psExp);
            return;
        }
        var format = this.getFormat(psCookie);
        if (psVal && format.escapedValue) {
            psVal = encodeURIComponent(psVal);
        }
        this.writeRawCookie(psCookie, psVal, psExp);
    },

    writeCookieAsync: async function(psCookie, psVal, psExp) {
        //@param    pbSecure - secured? (optional)
        //Check conversion map
        var cmap = aConversionMap[psCookie];
        if (cmap) {
            await this.writeCookieletAsync(cmap[0], cmap[1], psVal, psExp);
            return;
        }
        var format = this.getFormat(psCookie);
        if (psVal && format.escapedValue) {
            psVal = encodeURIComponent(psVal);
        }
        if(this.isCookieStoreAvialable()) {
            await this.writeRawCookieAsync(psCookie, psVal, psExp);
        }
        else {
            this.writeRawCookie(psCookie, psVal, psExp);
        }
    },

    prepareCookie: function(psCookie, psVal, psExp) {
        if (psCookie && (psVal !== undefined)) {
            if ((isNaN(psVal) && psVal.length < 4000) || (psVal + '').length < 4000) {
                if (typeof psExp === 'number') {
                    psExp = this.getExpDate(psExp);
                }
                var expDate = psExp ? new Date(psExp) : new Date(this.getExpDate(730));
                var format = this.getFormat(psCookie);
                var sHost = this.sCookieDomain;
                var dd = document.domain;
                if (dd.indexOf(sHost) === -1) {
                    var index = dd.indexOf('.ebay.');
                    if (index > 0) {
                        this.sCookieDomain = dd.substring(index);
                    }
                }
                return {
                    name: psCookie,
                    value: (psVal || ""),
                    expires: psExp || format.bUseExp ? expDate.toGMTString() : "",
                    domain: this.sCookieDomain,
                    path: sPath
                };
            }
        }
        return null;
    },
    
    writeRawCookie: function(psCookie, psVal, psExp) {
        var cookie = this.prepareCookie(psCookie, psVal, psExp);
        if (cookie && document.cookie) {
            document.cookie = cookie.name + "=" + cookie.value +
                (cookie.expires ? "; expires=" + cookie.expires : "") +
                "; domain=" + cookie.domain +
                "; path=" + cookie.path;
        }
    },

    writeRawCookieWithPartitioned: function(psCookie, psVal, psExp) {
        var cookie = this.prepareCookie(psCookie, psVal, psExp);
        if (cookie && document.cookie) {
            document.cookie = cookie.name + "=" + cookie.value +
                (cookie.expires ? "; expires=" + cookie.expires : "") +
                "; domain=" + cookie.domain +
                "; path=" + cookie.path +
                "; Secure" +
                "; Partitioned";
        }
    },
    
    writeRawCookieAsync: async function(psCookie, psVal, psExp) {
        var cookie = this.prepareCookie(psCookie, psVal, psExp);
        // Refine the cookie domain to remove the leading dot and expires attribute
        // To fit in cookieStore API
        cookie = this.convertCookieToCookieStore(cookie);
        if (cookie && window.cookieStore) {
            await window.cookieStore.set(cookie);
        }
    },

    writeRawCookieWithPartitionedAsync: async function(psCookie, psVal, psExp) {
        var cookie = this.prepareCookie(psCookie, psVal, psExp);
        if (!cookie) {
            return;
        }

        // Refine the cookie domain to remove the leading dot and expires attribute
        // To fit in cookieStore API
        cookie = this.convertCookieToCookieStore(cookie);

        if (cookie && window.cookieStore) {
            // Add partitioned and secure attributes for cookieStore API
            cookie.partitioned = true;
            cookie.secure = true;
            await window.cookieStore.set(cookie);
        }
    },

    // Function to convert document.cookie spec to cookieStore API spec
    //  Input: var cookie = this.prepareCookie(psCookie, psVal, psExp);
    //  Output: cookie = {name: psCookie, value: psVal, expires: psExp, domain: this.sCookieDomain, path: sPath};
    convertCookieToCookieStore: function(cookie) {
        return {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain.replace(/^\./, ''),
            expires: cookie.expires == '' ? null : new Date(cookie.expires),
            path: cookie.path
        };
    },

    /**
    * Writes a value String to a given cookie. You can put the days to expired
    * this cookie from the current time.
    *
    * @param {String} cookie
    *        a string name of the cookie to be written
    * @param {String} value
    *        a string value to be written in cookie
    * @param {int} expDays
    *        the number of days that represents how long the cookie will be
    *        expired
    * @see #writeCookie
    */
    //>public void writeCookieEx(String,String,int);
    writeCookieEx: function(psCookie, psVal, piDays) {
        this.writeCookie(psCookie, psVal, this.getExpDate(piDays));
    },

    /**
    * Writes value to cookielet. You can use {@link writeMultiLineCookie} for
    * some multi-level cookielet.
    *
    * @param {String} cookie
    *        the name of the specified cookie which contains the cookielet to be
    *        write
    * @param {String} cookielet
    *        the name of the cookielet to be write
    * @param {String} val
    *        the value of the cookielet
    * @param {String} exp
    *        an expired date of the cookielet
    * @param {String} contExp
    *        an expired date of the cookie
    * @see #writeMultiLineCookie
    */
prepareCookielet: function(psCookie, psCookielet, psVal, psExp) {
    if (psCookie && psCookielet) {
        var format = this.getFormat(psCookie);
        if (format.bUseExp && psVal) {
            //Set the default exp date to 2 yrs from now
            if (typeof psExp === 'number') {
                psExp = this.getExpDate(psExp);
            }
            var expDate = psExp ? new Date(psExp) : new Date(this.getExpDate(730)); //<Date
            var expDateUTC = Date.UTC(expDate.getUTCFullYear(), expDate.getUTCMonth(), expDate.getUTCDate(), expDate.getUTCHours(), expDate.getUTCMinutes(), expDate.getUTCSeconds()); // jshint ignore:line
            expDateUTC = Math.floor(expDateUTC / 1000);
            //psVal += expDateUTC.dec2Hex();
            psVal += parseInt(expDateUTC, 10).toString(16);
        }
        return this.createCookieValue(psCookie, psCookielet, psVal);
    }
    return null;
},

writeCookielet: function(psCookie, psCookielet, psVal, psExp, psContExp) { // jshint ignore:line
    this.update();
    var val = this.prepareCookielet(psCookie, psCookielet, psVal, psExp);
    if (val) {
        this.writeRawCookie(psCookie, val, psContExp);
    }
},

writeCookieletAsync: async function(psCookie, psCookielet, psVal, psExp, psContExp) {
    await this.updateAsync();
    var val = this.prepareCookielet(psCookie, psCookielet, psVal, psExp);

    if(!val) {
        return;
    }
    // check if cookieStore API is available in the browser
    if(this.isCookieStoreAvialable()) {
        await this.writeRawCookieAsync(psCookie, val, psContExp);
    }
    // fallback to writeRawCookie
    else {
        this.writeRawCookie(psCookie, val, psContExp);
    }
},

    /**
    * Writes value to some multi-level cookielet. Some cookielet contains sub
    * level, and you can use the name of the cookielet as cookie name and write
    * its sub level value.
    * These cookielet includes:
    * <p>
    * <pre>
    * Name as Cookie | name in cookielet         | upper level cookie
    * -------------- |---------------------------|----------------------
    * reg            | reg                       | dp1
    * recent_vi      | lvmn                      | ebay
    * ebaysignin     | sin                       | ebay
    * p              | p                         | dp1
    * etfc           | etfc                      | dp1
    * keepmesignin   | kms                       | dp1
    * BackToList     | BIBO_BACK_TO_LIST         | s
    * reg            | reg                       | dp1
    * </pre>
    * <p>
    * you need to use {@link writeCookielet} for other cookielet.
    *
    * @param {String} cookie
    *        the name of the specified cookie which contains the cookielet to be write
    * @param {String} cookielet
    *        the mame of the cookielet to be write
    * @param {String} val
    *        the value of the cookielet
    * @param {String} exp
    *        an expired date of the cookielet
    * @param {String} contExp
    *        an expired date of the cookie
    * @see #writeCookielet
    */
    //> public void writeMultiLineCookie(String,String,String,String,String);
    writeMultiLineCookie: function(psCookie, psCookielet, psVal, psExp, psContExp) { // jshint ignore:line
        this.update();
        var val = this.createCookieValue(psCookie, psCookielet, psVal);
        if (val) {
            var cmap = aConversionMap[psCookie];
            if (cmap) {
                this.writeCookielet(cmap[0], cmap[1], val, psExp, psContExp);
            }
        }
    },

    /**
    * Gets the bit flag value at a particular position.This function is
    * deprecated, use {@link #getBitFlag} instead.
    *
    * @deprecated
    * @param {String} dec
    *        a bit string that contains series of flags
    * @param {int} pos
    *        the flag position in the bit string
    * @return {int}
    *        the flag value
    * @see #getBitFlag
    */
    //> public int getBitFlagOldVersion(String, int);
    getBitFlagOldVersion: function(piDec, piPos) {
        //converting to dec
        var dec = parseInt(piDec, 10);//<Number
        //getting binary value //getting char at position
        var b = dec.toString(2), r = dec ? b.charAt(b.length - piPos - 1) : "";
        return (r == "1") ? 1 : 0; // jshint ignore:line
    },

    /**
    * Sets the bit flag at a particular position. This function is deprecated,
    * use {@link #setBitFlag} instead.
    *
    * @deprecated
    * @param {String} dec
    *        a bit string contains series of flags
    * @param {int} pos
    *        the flag position in the bit string
    * @param {int} val
    *        the flag value to be set. Flag will be set as 1 only if the value of
    *        this parameter is 1
    * @see #setBitFlag
    */
    //> public int setBitFlagOldVersion(int, int, int);
    setBitFlagOldVersion: function(piDec, piPos, piVal) {
        var b = "", p, i, e, l;
        //converting to dec
        piDec = parseInt(piDec + "", 10);
        if (piDec)
        {
            //getting binary value
            b = piDec.toString(2);
        }
        l = b.length;
        if (l < piPos)
        {
            e = piPos - l;
            for (i = 0; i <= e; i++)
            {
                b = "0" + b;
            }
        }
        //finding position
        p = b.length - piPos - 1;
        //replacing value at pPos with pVal and converting back to decimal
        return parseInt(b.substring(0, p) + piVal + b.substring(p + 1), 2);
    },

    /**
    * Gets the bit flag value at a particular position.
    *
    * @param {String} dec
    *        a bit string which contains series of flags
    * @param {int} pos
    *        the flag position in the bit string
    * @return {int}
    *        the flag value
    */
    //> public int getBitFlag(String,int);
    getBitFlag: function(piDec, piPos) {

        if (piDec !== null && piDec.length > 0 && piDec.charAt(0) === '#')
        {
            var length = piDec.length;
            var q = piPos % 4;
            var hexPosition = Math.floor(piPos / 4) + 1;

            var absHexPosition = length - hexPosition;
            var hexValue = parseInt(piDec.substring(absHexPosition, absHexPosition + 1), 16);
            var hexFlag = 1 << q;

            return ((hexValue & hexFlag) == hexFlag) ? 1 : 0; // jshint ignore:line
        }
        else
                {
                    //process by old format
                    return this.getBitFlagOldVersion(piDec, piPos);
                }

    },

    /**
    * Set the bit flag at a particular position.
    *
    * @param {String} dec
    *        A bit string that contains series of flags
    * @param {int} pos
    *        the flag position in the bit string
    * @param {int} val
    *        the falg value to be set. Flag will be set as 1 only if the value of
    *        this parameter is 1.
    */
    //> public int setBitFlag(String,int,int);
    //> public int setBitFlag(int,int,int);
    setBitFlag: function(piDec, piPos, piVal) { // jshint ignore:line

        if (piDec !== null && piDec.length > 0 && piDec.charAt(0) === '#')
        {
            //process by new format
            var length = piDec.length;
            var q = piPos % 4;
            var hexPosition = Math.floor(piPos / 4) + 1;

            if (length <= hexPosition)
            {
                if (piVal != 1) { // jshint ignore:line
                    return piDec;
                }

                var zeroCout = hexPosition - length + 1;
                var tmpString = piDec.substring(1, length);
                while (zeroCout > 0)
                {
                    tmpString = '0' + tmpString;
                    zeroCout--;
                }

                piDec = '#' + tmpString;
                length = piDec.length;
            }

            var absHexPosition = length - hexPosition;
            var hexValue = parseInt(piDec.substring(absHexPosition, absHexPosition + 1), 16);
            var hexFlag = 1 << q;

            if (piVal == 1) // jshint ignore:line
            {
                hexValue |= hexFlag;
            }
            else
                        {
                            hexValue &= ~hexFlag;
                        }

            piDec = piDec.substring(0, absHexPosition) + hexValue.toString(16) + piDec.substring(absHexPosition + 1, length); // jshint ignore:line

            return piDec;

        }
        else
                {
                    if (piPos > 31)
                    {
                        return piDec;
                    }
                    //process by old format
                    return this.setBitFlagOldVersion(piDec, piPos, piVal);
                }

    },

    //> private String  createCookieValue (String, String, String);
    createCookieValue: function(psName, psKey, psVal) { // jshint ignore:line
        var cmap = aConversionMap[psName], format = this.getFormat(psName),
                mode = this.getMode(psName), val;
        if (cmap && (mode == sSTRICT || mode == sCONVER)) { // jshint ignore:line
            val = this.readCookieObj(cmap[0], cmap[1]).value || "";
        }
        else {
            val = this.aCookies[psName] || "";
        }

        if (format) {
            var clts = this.getCookieletArray(val, format);
            clts[psKey] = psVal;
            var str = "";
            for (var i in clts) {
                // eslint-disable-next-line no-prototype-builtins
                if (clts.hasOwnProperty(i)) {
                    str += i + format.NAME_VALUE_DELIMITER + clts[i] + format.COOKIELET_DELIMITER;
                }
            }

            if (str && format.startDelim) {
                str = format.startDelim + str;
            }
            val = str;

            if (format.escapedValue) {
                val = encodeURIComponent(val);
            }
        }

        return val;
    },

    updateAsync: async function() {
        if(this.isCookieStoreAvialable()) {
            const cookies = await window.cookieStore.getAll();
            this.aCookies = {};
            const regE = new RegExp('^"(.*)"$');
            // Set the cookies based on the getAll response
            for (let i = 0; i < cookies.length; i++) {
                const format = this.getFormat(cookies[i].name);
                const cv = cookies[i].value;
                const sd = format.startDelim;
                if (sd && cv && cv.indexOf(sd) === 0) {
                    cookies[i].value = cv.substring(sd.length, cv.length);
                }
                // check if the value is enclosed in double-quotes, then strip them
                if (cookies[i].value && cookies[i].value.match(regE)) {
                    cookies[i].value = cookies[i].value.substring(1, cookies[i].value.length - 1);
                }
                this.aCookies[cookies[i].name] = cookies[i].value;
            }
        }
    },

    isCookieStoreAvialable: function() {
        return window.cookieStore ? true : false;
    },

    //> private void update();
    update: function() {
            //store cookie values
            var aC = document.cookie.split("; ");
            this.aCookies = {};
            var regE = new RegExp('^"(.*)"$');
            for (var i = 0; i < aC.length; i++) {
                var sC = aC[i].split("=");

                var format = this.getFormat(sC[0]), cv = sC[1], sd = format.startDelim;
                if (sd && cv && cv.indexOf(sd) === 0) {
                    sC[1] = cv.substring(sd.length, cv.length);
                }
                // check if the value is enclosed in double-quotes, then strip them
                if (sC[1] && sC[1].match(regE)) {
                    sC[1] = sC[1].substring(1, sC[1].length - 1);
                }
                this.aCookies[sC[0]] = sC[1];
            }
        },

    //> private String getCookielet(String, String, String);
    getCookielet: function(psCookie, psCookielet, psVal) {
        var format = this.getFormat(psCookie);
        var clts = this.getCookieletArray(psVal, format);
        return clts[psCookielet] || "";
    },

    //> private Object getFormat(String);
    getFormat: function(psCookie) {
        return aFormatMap[psCookie] || DEFAULT_COOKIE_FORMAT;
    },

    //> private Object getCookieletArray(String, Object);
    getCookieletArray: function(psVal, poFormat) {
        var rv = [], val = psVal || "";
        if (poFormat.escapedValue) {
            val = decodeURIComponent(val);
        }
        var a = val.split(poFormat.COOKIELET_DELIMITER);
        for (var i = 0; i < a.length; i++) { //create cookielet array
            var idx = a[i].indexOf(poFormat.NAME_VALUE_DELIMITER);
            if (idx > 0) {
                rv[a[i].substring(0, idx)] = a[i].substring(idx + 1);
            }
        }
        return rv;
    },

    /**
    * Gets the date behind a given days from current date. This is used to set
    * the valid time when writing the cookie.
    *
    * @param {int} days
    *        the number of days that cookie is valid
    * @return {String}
    *        the expiration date in GMT format
    */
    //> public String getExpDate(int);
    getExpDate: function(piDays) {
        var expires;
        if (typeof piDays === "number" && piDays >= 0) {
            var d = new Date();
            d.setTime(d.getTime() + (piDays * 24 * 60 * 60 * 1000));
            expires = d.toGMTString();
        }
        return expires;
    },

    //> private Object getMode(String);
    getMode: function(psCookie) { // jshint ignore:line
        var h = this.readCookieObj(sModesCookie, sModesCookielet).value,
                b,
                i;
        if (!(psCookie in aConversionMap)) {
            return null;
        }
        if (!h) {
            return "";
        }
        //default mode is STRICT when h is "0"
        if (h === 0) {
            return sSTRICT;
        }

        if (h && h != "0") { // jshint ignore:line
            //checking for h is having "." or not
            //if (h.has(".")){
            if (h.indexOf(".") !== -1) {
                //conversion cookie is having more than 15 cookie values
                var a = h.split(".");
                //looping through array
                for (i = 0; i < a.length; i++) {
                    //taking the first hex nubmer and converting to decimal
                    //and converting to binary
                    b = parseInt(a[i], 16).toString(2) + b;
                }
            }
            else {
                //converting to decimal
                //converting to binary number
                b = parseInt(h, 16).toString(2);
            }
            //fill the convArray with appropriate mode values
            i = 0;
            //getting total binary string length
            var l = b.length, j;
            //looping through each cookie and filling mode of the cookie
            for (var o in aConversionMap)
            {
                //find the position to read
                j = l - (2 * (i + 1));
                //reading backwards 2 digits at a time
                var f = b.substring(j, j + 2).toString(10);
                f = (!f) ? sSTRICT : f;
                if (psCookie == o) // jshint ignore:line
                {
                    return (f.length === 1) ? "0" + f : f;
                }
                i++;
            }
            return null;
        }

        return null;

    },

    getMulti: function(piDec, piPos, piBits) {
        var r = "", i, _this = this;
        for (i = 0; i < piBits; i++) {
            r = _this.getBitFlag(piDec, piPos + i) + r ;
        }
        return parseInt(r, 2);
    },

    setMulti: function(piDec, piPos, piBits, piVal) {
        var i = 0, _this = this, v, l, e;
        //convert to binary and take piBits out of it
        v = piVal.toString(2).substring(0, piBits);
        l = v.length;
        if (l < piBits) {
            e = piBits - l;
            for (var j = 0; j < e; j++) {
                v = "0" + v;
            }
            l = l + e;
        }
        for (i = 0; i < l; i++) {
            piDec = _this.setBitFlag(piDec, piPos + i, v.substring(l - i - 1, l - i));
        }
        return piDec;
    },

    setJsCookie: function() {
        this.writeCookielet('ebay', 'js', '1');
    }

};

function eventInit() {
    var callback = function() {
        api.setJsCookie();
    };

    if (window.addEventListener) {
        window.addEventListener('beforeunload', callback);
    } else if (window.attachEvent) {
        window.attachEvent('onbeforeunload', callback);
    }

//     if (typeof jQuery !== 'undefined' && typeof $ !== 'undefined') {
//         $(document).bind("ajaxSend", callback);
//     }
}

// Browser
if (typeof window !== "undefined") {
    // Initialize the events
    eventInit();

    // expose the API in windows for core platform services - Tracking & EP
    window["@ebay/cookies-browser"] = api;
    // for backwards compatibility
    // ebay-scope-conversion-skip-next-line
    window["cookies-browser"] = api;
}

// expose the API as CommonJS module
if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
}
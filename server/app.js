//Dependancies
  const express = require("express")
  const app = express()
  const request = require("request")
  const moment = require("moment")
  const cheerio = require("cheerio")
  const argv = require("minimist")(process.argv.slice(2))

//Nimbus app
  const nimbus = {
    //Check values
      check(values, options) {
        //Iterate though defined options
          try {
            const checked = {error:false}
            for (let param in options) {
              //Options and values
                const {dvalue, required, transform, check, post} = options[param]
                let value = values[param]
              //Default value
                if (typeof dvalue !== "undefined")
                  value = dvalue
              //Check if required and undefined
                if ((required)&&(typeof value === "undefined"))
                  throw `MISSING_PARAMETER : ${param}`
              //Transform value if needed
                if (transform)
                  value = transform(value)
              //Check value 
                if ((required)&&(check)&&(!check(value)))
                  throw `INVALID_PARAMETER : ${param} (value "${value}" does not meet requirements)`
              //Post transform
                if (post)
                  value = post(value)
              //Register value
                checked[param] = value
            }
            return checked
          }
        //Handle errors
          catch (e) { 
            return {error:true} 
          }
      },
    //Type checker
      is:{
        icao:x => /^LF[A-Z]{2}$/.test(x),
        year:x => /^2\d{3}$/.test(x),
        month:x => (x >= 0)&&(x <= 11),
        day:x => (x >= 1)&&(x <= 31),
        hours:x => (x >= 0)&&(x <= 23),
        minutes:x => (x >= 0)&&(x <= 59),
        positive:x => (x > 0),
        boolean:x => /0|1/.test(x),
      },
    //Transformers
      to:{
        icao:x => (""+x).toString().toLocaleUpperCase(),
        
      },
    //Post transformers
      post:{
        pad2:x => (0+x).toString().padStart(2, "0"),
        month:x => nimbus.post.pad2(1+x),
        meteo_hours:x => nimbus.post.pad2(Math.floor(x/3)*3),
        flight_level:x => `F${x.toString().padStart(3, "0")}`,
        string:x => (""+x).toString(),
      }
  }
  
//Serve client files
  app.use("/", express.static("client"))
  app.use("/js", express.static("node_modules/vue/dist"))
  app.use("/js", express.static("node_modules/less/dist"))
  app.use("/js", express.static("node_modules/axios/dist"))

//Serve VAC
  app.get("/vac/:icao", (req, res) => {
    //Check params
      const {error, icao} = nimbus.check(req.params, {
        icao:{required:true, transform:nimbus.to.icao, check:nimbus.is.icao},
      })
    //Check eventual errors
      if (error)
        return res.sendStatus(400)
    //Handle request
      const url = `https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_27_FEB_2020/Atlas-VAC/PDF_AIPparSSection/VAC/AD/AD-2.${icao}.pdf`
      request.get(url).pipe(res)
  })

//Serve TEMSI
  app.get("/temsi/", (req, res) => {
    //Check params
      const {error, year, month, day, hours} = nimbus.check(req.params, {
        year:{required:true, dvalue:moment().year(), check:nimbus.is.year},
        month:{required:true, dvalue:moment().month(), check:nimbus.is.month, post:nimbus.post.month},
        day:{required:true, dvalue:moment().date(), check:nimbus.is.day, post:nimbus.post.pad2},
        hours:{require:true, dvalue:moment().hours(), check:nimbus.is.meteo_hours, post:nimbus.post.meteo_hours},
      })
    //Check eventual errors
      if (error)
        return res.sendStatus(400)
    //Handle request
      const date = `${year}${month}${day}${hours}0000`
      const url = `https://aviation.meteo.fr/FR/aviation/affiche_image.php?login=fampsLSMuYmAdrAK4GqaaGhim2ppYWnd1uE%3D&layer=sigwx/fr/france&echeance=${date}`
      request.get(url).pipe(res)
  })

//Serve WINTEM
  app.get("/wintem/", (req, res) => {
    //Check params
      const {error, year, month, day, hours} = nimbus.check(req.params, {
        year:{required:true, dvalue:moment().year(), check:nimbus.is.year},
        month:{required:true, dvalue:moment().month(), check:nimbus.is.month, post:nimbus.post.month},
        day:{required:true, dvalue:moment().date(), check:nimbus.is.day, post:nimbus.post.pad2},
        hours:{require:true, dvalue:moment().hours(), check:nimbus.is.meteo_hours, post:nimbus.post.meteo_hours},
      })
    //Check eventual errors
      if (error)
        return res.sendStatus(400)
    //Handle request
      const date = `${year}${month}${day}${hours}0000`
      const url = `https://aviation.meteo.fr/FR/aviation/affiche_image.php?login=fampsLSMuYmAdrAK4GqaaGhim2plZm3d1uE%3D&layer=wintemp/fr/france/fl020&echeance=${date}`
      request.get(url).pipe(res)
  })

//Serve NOTAM (use olivia)
  app.get("/notam/olivia/:icaos", (req, res) => {
    //Check params
      const icaos = (req.params.icaos||"").split(",").map(icao => nimbus.check({icao}, {icao:{transform:nimbus.to.icao}}).icao).filter(nimbus.is.icao)
      const {error, month, day, hours, minutes, duration, radius, fl} = nimbus.check({...req.params, ...req.query}, {
        month:{required:true, dvalue:moment().month(), check:nimbus.is.month, post:nimbus.post.month},
        day:{required:true, dvalue:moment().date(), check:nimbus.is.day, post:nimbus.post.pad2},
        hours:{require:true, dvalue:moment().hours(), check:nimbus.is.hours, post:nimbus.post.pad2},
        minutes:{require:true, dvalue:moment().minutes(), check:nimbus.is.minutes, post:nimbus.post.pad2},
        duration:{require:true, dvalue:6, check:nimbus.is.positive, post:nimbus.post.pad2},
        radius:{require:true, dvalue:10, check:nimbus.is.positive, post:nimbus.post.string},
        fl:{require:true, dvalue:30, check:x => (x%5 === 0)&&(x >= 30)&&(x <= 115), post:nimbus.post.flight_level}
      })
    //Check eventual errors
      if ((error)||(icaos.length < 1)||(icaos.length > 16))
        return res.sendStatus(400)
    //Convert to UTC
      const utc = moment(`${moment.utc().year()}${month}${day}T${hours}${minutes}`).add(15, "minutes").subtract(1, "hour")
      const utc_hours = `${nimbus.post.pad2(utc.hours())}${nimbus.post.pad2(utc.minutes())}`
      icaos.push(...new Array(16).fill(""))
    //Handle request
      const jar = request.jar()
      request.get("http://olivia.aviation-civile.gouv.fr/", {jar, followAllRedirects: true}, () => 
        request.post("http://olivia.aviation-civile.gouv.fr/notam/olNotamAerodromesVerif.php", {jar, headers:{"Content-Length": 315}, form:{
          aerodrome1:icaos[0], aerodrome2:icaos[1], aerodrome3:icaos[2], aerodrome4:icaos[3], aerodrome5:icaos[4], aerodrome6:icaos[5], aerodrome7:icaos[6], aerodrome8:icaos[7], aerodrome9:icaos[8], aerodrome10:icaos[9], aerodrome11:icaos[10], aerodrome12:icaos[11], aerodrome13:icaos[12], aerodrome14:icaos[13], aerodrome15:icaos[14], aerodrome16:icaos[15],
          date:`${day}${month}`,
          heure:utc_hours,
          dureeNotam:duration,
          vfr:"on",
          ifr:"on",
          rayon:radius,
          plafond:fl,
          presentationDetaillee:"on",
          notamGPS:"on",
          BulAeroSoumis:"++++OK++++",
        }}, () => 
          request.get("http://olivia.aviation-civile.gouv.fr/notam/olNotamAerodromesBulletin.php", {jar}, (a, b, body) => {
            const $ = cheerio.load(body)
            res.send($("form").html())
          })  
        )
      )  
  })

//Serve NOTAM (use notamweb)
  app.get("/notam/web/:icaos", (req, res) => {
    //Check params
      const icaos = (req.params.icaos||"").split(",").map(icao => nimbus.check({icao}, {icao:{transform:nimbus.to.icao}}).icao).filter(nimbus.is.icao)
      const {error, year, month, day, hours, minutes, duration, radius, fl, json} = nimbus.check({...req.params, ...req.query}, {
        year:{required:true, dvalue:moment().year(), check:nimbus.is.year},
        month:{required:true, dvalue:moment().month(), check:nimbus.is.month, post:nimbus.post.month},
        day:{required:true, dvalue:moment().date(), check:nimbus.is.day, post:nimbus.post.pad2},
        hours:{require:true, dvalue:moment().hours(), check:nimbus.is.hours, post:nimbus.post.pad2},
        minutes:{require:true, dvalue:moment().minutes(), check:nimbus.is.minutes, post:nimbus.post.pad2},
        duration:{require:true, dvalue:6, check:nimbus.is.positive, post:nimbus.post.string},
        radius:{require:true, dvalue:10, check:nimbus.is.positive, post:nimbus.post.string},
        fl:{require:true, dvalue:30, check:x => (x%5 === 0)&&(x >= 30)&&(x <= 115), post:nimbus.post.string},
        json:{require:true, dvalue:0, check:nimbus.is.boolean},
      })
    //Check eventual errors
      if ((error)||(icaos.length < 1)||(icaos.length > 16))
        return res.sendStatus(400)
    //Convert to UTC
      const utc = moment(`${moment.utc().year()}${month}${day}T${hours}${minutes}`).add(15, "minutes").subtract(1, "hour")
      const utc_hours = `${nimbus.post.pad2(utc.hours())}:${nimbus.post.pad2(utc.minutes())}`
      icaos.push(...new Array(16).fill(""))
      const form = {
        bResultat:"true", bImpression:"", ModeAffichage:"COMPLET", AERO_Langue:"FR", AERO_CM_REGLE:"1", AERO_CM_GPS:"1", AERO_CM_INFO_COMP:"1",
        AERO_Date_DATE:`${year}/${month}/${day}`,
        AERO_Date_HEURE:utc_hours,
        AERO_Duree:duration,
        AERO_Rayon:radius,
        AERO_Plafond:fl,
        "AERO_Tab_Aero[0]":icaos[0], "AERO_Tab_Aero[1]":icaos[1], "AERO_Tab_Aero[2]":icaos[2], "AERO_Tab_Aero[3]":icaos[3], "AERO_Tab_Aero[4]":icaos[4], "AERO_Tab_Aero[5]":icaos[5], "AERO_Tab_Aero[6]":icaos[6], "AERO_Tab_Aero[7]":icaos[7], "AERO_Tab_Aero[8]":icaos[8], "AERO_Tab_Aero[9]":icaos[9], "AERO_Tab_Aero[10]":icaos[10], "AERO_Tab_Aero[11]":icaos[11], 
      }, content_length = Buffer.byteLength(Object.entries(form).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&"))
    //Handle request
      const jar = request.jar()
      request.get("http://notamweb.aviation-civile.gouv.fr/", {jar, followAllRedirects: true}, () => 
        request.post("http://notamweb.aviation-civile.gouv.fr/Script/IHM/Bul_Aerodrome.php?AERO_Langue=FR", {jar, headers:{
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:75.0) Gecko/20100101 Firefox/75.0",
          "Content-Length": content_length,
        }, form}, (a, b, body) => {
          const $ = cheerio.load(body), notam = {bulletins:{}}
          //Normalize keys and value
            const normalize = {
              "Date de production (UTC) :": "edited",
              "Date et heure (UTC) de validité :": "validity",
              "Durée :": "duration",
              "Règle de vol :": "rules",
              "Sélection des NOTAM GPS :": "gps",
              "Type NOTAM :": "type",
              "Rayon (Nm) :": "radius",
              "Niveau plafond (FL) :": "flight_level",
              "Aérodromes :": "aerodromes",
              "Oui": true, "Non": false, "Général et divers": "General and miscelleanous",
            }
          //Criterias
            const criterias = $("table .CRITERE").filter((i, e) => $(e).text().trim().length).map((i, e) => {
              const [key, value] = [$(e).find("td:first-child").text().trim(), $(e).find("td:last-child").text().trim()].map(x => normalize[x]||x)
              notam[key] = value 
            })
          //Bulletins
            const bulletins = $("table .NOTAMBulletin").filter((i, e) => $(e).text().trim().length)
            let aerodrome = null
            for (let bulletin of Array.from(bulletins)) {
              //Check if aerodrome
                if ($(bulletin).find(`td[colspan="2"] a`).length) {
                  aerodrome = $(bulletin).find(`td[colspan="2"] a`).text().trim()
                  notam.bulletins[aerodrome] = []
                  continue
                }
              //Check if bulletin
                if ($(bulletin).find(`pre`).length) {
                  const text = $(bulletin).find(`pre`).text().trim(), notice = {}
                  //Match each section
                    notice._ = text.match(/^([\s\S]*?)\n/)[1]
                    text.replace(/[\n ]([A-Z])\)((?:[\s\S](?![\n ][A-Z]\)))*\S)/g, (m, k, v) => notice[k] = v.trim())
                  notam.bulletins[aerodrome].push(notice)
                }
            }
          res.send(notam)
        })
      )  
  })

//OPMET

//Start server
  const port = argv.port||3000
  app.listen(port, () => console.log(`Listening on port ${port}`))

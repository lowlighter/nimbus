(async function () {
  //Lang
    const lang = {
      //Plan
        plan:{
          //Checks
            checks:{
              pilot:{
                name:"👨‍✈️ Pilote",
                id:{name:"Pièce d'identité"},
                licence:{name:"Licence en cours de validité", details:"Vérifiez que la qualification de classe est valide et compatible avec l'avion utilisé"},
                medical_certificate:{name:"Certificat médical à jour", details:"Vérifiez la date de fin de validité ainsi que les obligations complémentaires (emport de lunettes, etc.)"},
                flight_capacity:{name:"Capacité à voler", details:""},
                pax_takeout:{name:"Emport passagers"},
                pax_experience:{name:"Expérience récente pour l'emport de passagers", details:"3 atterrissages et 3 décollages dans les 90 derniers jours"},
              },
              aircraft:{
                name:"🛩️ Avion",
                log_book:{name:"Carnet de route", details:"Vérifiez qu'il n'y ait aucune mention particulière inscrite sur le carnet de route ainsi que le potentiel avant le prochain contrôle technique"},
                flight_manual:{name:"Manuel de vol"},
                mel:{name:"Liste minimale d'équipement (si applicable)"},
                flight_plan:{name:"Plan de vol (si déposé)"},
                registration_certificate:{name:"Certificat d'immatriculation (original)"},
                airworthiness_certificate:{name:"Certificat de navigabilité et certificat d'examen de navigabilité (originaux)"},
                acoustic_certificate:{name:"Certificat acoustique EASA (si applicable)"},
                aircraft_station_license:{name:"Licence de station d'aéronef"},
                insurance_certificate:{name:"Attestation d'assurance"},
              },
              weather:{
                name:"⛅ Météo",
                sunset_time:{name:"Heure du coucher de soleil notée"},
                temsi:{name:"TEMSI vérifiés"},
                wintem:{name:"WINTEM vérifiés"},
                taf_metar:{name:"TAF et METAR vérifiés"},
              }
            },
          //Route
            route:{
              airport:{
                new:"Nouvelle destination",
                distance:{
                  previous:"Distance par rapport à l'aérodrome précédent",
                  total:"Distance totale",
                }
              }
            },
          //Notam
            notam:{
              loading:"Chargement des NOTAM...",
            }
        },
      //Airport
        airport:{
          altitude:"Altitude",
          altitude_short:"Alt.",
          coordinates:"Longitude et latitude",
          radio:"Fréquences radios",
          services:{
            avt:"Avitaillement",
            rep:"Réparations",
            eat:"Restaurant",
            slp:"Hôtel",
          },
          vac:"Carte VAC",
          icao:"OACI",
        },
      //App
        app:{
          name:"Nimbus - v. 0.1-alpha",
          description:[
            "Nimbus est un outil permettant de planifier vos vols en France métropolitaine.",
            "Vous pouvez créer votre plan de vol, consulter les cartes VAC, WINTEM, TEMSI et les NOTAM associés aux aérodromes sur votre trajet et vérifier que vous n'avez rien oublié grâce à la checklist.",
            `<div style="margin-top:.75rem">Bon vol !</div>`,
          ],
          menu:{
            links:{
              map:"Afficher la carte de France métropolitaine et les aérodromes",
              vac:"Afficher la carte VAC d'un aérodrome à partir de son code OACI",
              checks:"Vérifier que vous n'avez rien oublié lors de la préparation de votre vol",
              temsi:"Vérifier le TEMSI le plus récent",
              wintem:"Vérifier le WINTEM le plus récent",
              notam:"Afficher les NOTAM du trajet",
              help:"Obtenir de l'aide sur cette application",
            }
          },
          warning:"Notez que l'utilisation de Nimbus seul n'est probablement pas suffisant une planification rigoure de votre vol. Ultimement, la préparation et le bon déroulement de votre vol ne dépendent que de vous",
          features:{
            name:"Fonctionnalités",
            list:[
              {
                name:"🌍 Plan de route",
                features:[
                  {
                    name:"Ajouter des aérodromes dans votre plan de route pour :",
                    details:[
                      {name:"Obtenir l'altitude (⛰️), la position (🧭) de l'aérodrome ainsi que les éventuels services disponibles (avitaillement (⛽), réparations (🔧), restauration (🍽️), hôtel (🛏️), etc.)"},
                      {name:"Visualiser la carte VAC (🗺️) de l'aérodrome"},
                      {name:"Calculer automatiquement la distance à vol d'oiseau par rapport à l'aérodrome précédent ainsi que la distance à vol d'oiseau totale du trajet"},
                      {name:"Lister les NOTAM associés aux aérodromes proches de ceux lister sur votre plan de route"},
                    ]
                  },
                  {
                    name:"Ajouter des points de passages dans votre plan de route pour :",
                    dev:true,
                    details:[
                      {name:"Prévisualiser votre trajet sur la carte de France", dev:true},
                    ]
                  },
                ]
              },
              {
                name:"⛅ Météo",
                features:[
                  {
                    name:"Afficher les TEMSI du jour",
                    details:[]
                  },
                  {
                    name:"Afficher les WINTEM du jour",
                    details:[]
                  }
                ]
              },
              {
                name:"📝 Checklist",
                features:[
                  {
                    name:"Vérifier que rien n'a été oublié et que vous être prêt pour voler",
                    details:[]
                  },
                ]
              }
            ]
          }
        }
    }

  //Data
    const data = {
      airports:(await axios.get("/data/airports.json")).data,
    }

  //Flight plan
    const plan = {
      //Cached values
        cache:{airport:{new:{value:"", error:null}, vac:""}},
      //Route
        route:["LFOI", "LFAT"],
        remove(icao) { this.route.includes(icao) ? this.route.splice(this.route.indexOf(icao), 1) : null },
        update(icao, trim) {
          icao = icao.toLocaleUpperCase()
          if (trim)
            icao = icao.substring(0, 4)
          if (icao in data.airports) {
            this.route.push(icao) 
            this.cache.airport.new.value = ""
          }
          else 
            this.cache.airport.new.error = 404
        },
      //Documents to show
        show:{
          home:true,
          help:null,
          vac:null,
          temsi:null,
          wintem:null,
          notam:null,
          checks:null,
          map:null,
          get load() {
            const that = this
            this.vac = this.temsi = this.wintem = this.notam = this.checks = this.home = this.help = this.map = null
            return {
              set map(status) { that.map = status ; nimbus.init.map.append() },
              set home(status) { that.home = status },
              set vac(icao) { that.vac = icao },
              set help(status) { that.help = status },
              set checks(status) { that.checks = status },
              set temsi(status) { that.temsi = status },
              set wintem(status) { that.wintem = status },
              set notam(status) { that.notam = status ; axios.get(`/notam/olivia/${plan.route.join(",")}`).then(({data}) => plan.notam = data) },
            }
          }
        },
      //Checks
        checks:{
          pilot:{
            id:{value:false, when:true},
            licence:{value:false, when:true},
            medical_certificate:{value:false, when:true},
            flight_capacity:{value:false, when:true},
            pax_takeout:{value:false, when:true},
            pax_experience:{value:false, get when() { return plan.checks.pilot.pax_takeout.value }},
          },
          aircraft:{
            log_book:{value:false, when:true},
            flight_manual:{value:false, when:true},
            mel:{value:false, when:true},
            flight_plan:{value:false, when:true},
            registration_certificate:{value:false, get when() { return plan.route.length }},
            airworthiness_certificate:{value:false, get when() { return plan.route.length }},
            acoustic_certificate:{value:false, get when() { return plan.route.length }},
            aircraft_station_license:{value:false, get when() { return plan.route.length }},
            insurance_certificate:{value:false, get when() { return plan.route.length }},
          },
          weather:{
            sunset_time:{value:false, when:true},
            temsi:{value:false, when:true},
            wintem:{value:false, when:true},
            taf_metar:{value:false, when:true},
          }
        },
      //Notam
        notam:null,
    }

  //Nimbus global settings
    const nimbus = {
      settings:{
        maps:{
          api:"AIzaSyA21y8UGN0ShIelQthYLsBTQZERLcaCK24"
        }
      },
      init:{
        map:{
          element:null,
          pre() {
            //Load script
              const script = document.createElement("script")
              script.setAttribute("src", `https://maps.googleapis.com/maps/api/js?key=${nimbus.settings.maps.api}&callback=window.nimbus.init.map.post`)
              document.querySelector("body").append(script)
            //Create element
              this.element = document.createElement("map")
          },
          async post() {
            //Create map
              const map = new google.maps.Map(this.element, {
                center:{lat:46.71109, lng:1.7191036},
                zoom:5.5,
                fullscreenControl:false,
                streetViewControl:false,
              })
            //Create markers
              await data.airports
              Object.values(data.airports).forEach(airport => new google.maps.Marker({
                map,
                position:new google.maps.LatLng(airport.lat, airport.lng),
                title:airport.name
              }))
          },
          async append() {
            await app.$nextTick()
            const parent = document.querySelector(".map")
            if (parent)
              parent.appendChild(nimbus.init.map.element)
            else {
              await new Promise((solve) => setTimeout(solve, 100))
              this.append()
            }
          }
        }
      }
    }

  //Application
    const app = new Vue({
      el:"main",
      data:{
        app:{
          name:"Nimbus",
          version:"v. 0.1-alpha",
          lang,
        },
        plan,
        data,
      },
      methods:{
        about(airport) { return this.$data.data.airports[airport] || {name:" ", location:" ", alt:0, lat:0, lng:0, services:{}, radio:[]} },
        latlng({lat, lng}) { return `${Math.floor(lat%60)}°${Math.floor((lat*60)%60)}'${Math.floor((lat*3600)%60)}"N ${Math.floor(lng%60)}°${Math.floor((lng*60)%60)}'${Math.floor((lng*3600)%60)}"E` },
        dist(a, b) {
          //Airport data
            a = this.about(a)
            b = this.about(b)
          //Radians converter
            const rad = x =>  x*Math.PI/180
          //Haversine distance
            const al = rad(a.lat), bl = rad(b.lat), dlng = rad(b.lng-a.lng)
            return Math.ceil(Math.acos( Math.sin(al)*Math.sin(bl) + Math.cos(al)*Math.cos(bl) * Math.cos(dlng) ) * 6371)
        },
        ttdist(p) { return p.map((_, i) => i ? this.dist(p[i-1], p[i]) : 0).reduce((a, b) => a + b, 0) },
        strnorm(string) { return string.replace(/éêèë/gi, "e").replace(/âà/gi, "a").replace(/ô/gi, "o").replace(/ûùü/gi, "u").replace(/îï/gi, "i").replace(/ç/gi, "c") },
        airfilter(icao, name, input) { 
          icao = icao.toLocaleUpperCase()
          name = name.toLocaleUpperCase()
          input = input.toLocaleUpperCase()
          return icao.startsWith(input) || this.strnorm(name).includes(input) 
        }
      },
      mounted() {
        nimbus.init.map.pre()
      }
    })

  //Exports
    nimbus.app = app
    window.nimbus = nimbus

})()
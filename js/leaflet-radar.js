// TODO add refresh (reload time layers)
// TODO add buffer time to load layers where radar turned on

L.Control.Radar = L.Control.extend({

    NEXRAD_URL: `https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi`,
    NEXRAD_LAYER: `nexrad-n0q-900913`,
    NEXRAD_TMS_URL: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913',

    isPaused: false,
    timeLayerIndex: 0,
    timeLayers: [],

    options: {
        position: `topright`,
        opacity: 0.575,
        zIndex: 200,
        transitionMs: 750,
        playHTML: `&#9658;`,
        pauseHTML: `&#9616;`,
    },

    onRemove: function () {
        L.DomUtil.remove(this.container);
    },

    onAdd: function (map) {
        this.map = map;

        // setup control container
        this.container = L.DomUtil.create(`div`, "leaflet-radar");

        L.DomEvent.disableClickPropagation(this.container);
        L.DomEvent.on(this.container, `control_container`, function (e) {
            L.DomEvent.stopPropagation(e);
        });
        L.DomEvent.disableScrollPropagation(this.container);

        // add control elements within container
        checkbox_div = L.DomUtil.create(
            `div`,
            `leaflet-radar-toggle`,
            this.container
        );

        this.checkbox = document.createElement(`button`);
        this.checkbox.classList.add('fa')
        this.checkbox.classList.add('fa-play')
        this.checkbox.classList.add('fa-border')
        this.checkbox.style['font-size']='20px'
        this.checkbox.id = `leaflet-radar-toggle`;
        this.checkbox.onclick = () => this.toggle();

        checkbox_div.appendChild(this.checkbox);
        let slider_div = L.DomUtil.create(
            `div`,
            `leaflet-radar-slider`,
            this.container
        );

        this.slider = document.createElement(`input`);
        this.slider.id = `leaflet-radar-slider`;
        this.slider.type = `range`;
        this.slider.min = 0;

        slider_div.appendChild(this.slider);

        this.timestamp_div = L.DomUtil.create(
            `div`,
            `leaflet-radar-timestamp`,
            this.container
        );

        this.checkbox.checked = false
        this.toggle()
        return this.container;
    },

    hideLayerByIndex: function (index) {
        this.timeLayers[index].tileLayer.setOpacity(0);
        this.timestamp_div.innerHTML = ``;
    },

    showLayerByIndex: function (index) {
        this.timeLayers[index].tileLayer.setOpacity(
            this.options.opacity
        );
        this.timestamp_div.innerHTML = this.timeLayers[index].timestamp;
    },

    setDisabled: function (disabled) {
        this.slider.disabled = disabled;
        this.timestamp_div.innerText = ``;
    },

    toggle: function () {
        this.checkbox.checked = this.checkbox.checked ? false : true
        if (!this.checkbox.checked) {
            this.checkbox.classList.remove('fa-pause')
            this.checkbox.classList.add('fa-play')
            
//             this.checkbox.innerHTML = '<i class="fa fa-play fa-border" aria-hidden="true"></i>'
            this.isPaused = true;
        }
        else {
            this.checkbox.classList.remove('fa-play')
            this.checkbox.classList.add('fa-pause')
//             this.checkbox.innerHTML = '<i class="fa fa-pause fa-border" aria-hidden="true"></i>'
            
            const tempLayers = this.generateLayers();
            this.removeLayers();
            this.addLayers(tempLayers);
            this.timeLayers = tempLayers

            this.slider.max = this.timeLayers.length - 1;

//             this.timeLayerIndex = 0;

            this.isPaused = false;

            this.slider.oninput = () => {

                this.hideLayerByIndex(this.timeLayerIndex);
                this.timeLayerIndex = +this.slider.value;
                this.showLayerByIndex(this.timeLayerIndex);

                this.isPaused = true;
                this.checkbox.classList.remove('fa-pause')
                this.checkbox.classList.add('fa-play')
                this.checkbox.checked = false
            };
            if (this.timeLayerIndex != 0)
                this.timeLayerIndex--
            this.setTransitionTimer();
        }
    },

    setTransitionTimer: function () {
        setTimeout(() => {
            if (this.isPaused) {
                return;
            }

            this.timeLayers.forEach(timeLayer => {
                timeLayer.tileLayer.setOpacity(0);
                timeLayer.tileLayer.addTo(this.map);
            });

            if (this.checkbox.checked) {

                this.hideLayerByIndex(this.timeLayerIndex);
                this.incrementLayerIndex();
                this.showLayerByIndex(this.timeLayerIndex);

                this.slider.value = `${this.timeLayerIndex}`;

                this.setTransitionTimer();
            } else {
                this.setDisabled(true);
                this.removeLayers();
            }
        }, this.options.transitionMs);
    },

    incrementLayerIndex: function () {
        this.timeLayerIndex++;
        if (this.timeLayerIndex > this.timeLayers.length - 1) {
            this.timeLayerIndex = 0;
        }
    },

    addLayers: function () {
        
        this.timeLayers.forEach(timeLayer => {
            timeLayer.tileLayer.setOpacity(0);
            timeLayer.tileLayer.addTo(this.map);
        });
    },

    removeLayers: function () {
        this.timeLayers.forEach(timeLayer =>
            timeLayer.tileLayer.removeFrom(this.map)
        );
        this.timeLayers = [];
//         this.timeLayerIndex = 0;
    },

    generateLayers: function () {
        let timeLayers = [];

        const TOTAL_INTERVALS = 10;
        const INTERVAL_LENGTH_HRS = 5;

        const currentTime = new Date();
        function suffix(time) {  
            switch(time) {
                case 0:
                    return '-conus';
                case 5:
                    return '-m05m-conus';
                default:
                    return '-m' + time + 'm-conus';
            }
        }
        
        function timeString(time) {
            const spaces = time.toLocaleTimeString().split(' ')
            const colons = spaces[0].split(':')
            return colons[0] + ':' + colons[1] + ' ' + spaces[1]
        }

        for (let i = TOTAL_INTERVALS * INTERVAL_LENGTH_HRS; i >= 0; i -= INTERVAL_LENGTH_HRS) {

            const layer = L.tileLayer.wms(this.NEXRAD_URL, {
                layers: this.NEXRAD_LAYER + suffix(i),
                format: `image/png`,
                transparent: true,
                opacity: this.options.opacity,
                zIndex: this.options.zIndex,
            });
//             const layer = L.tileLayer(this.NEXRAD_TMS_URL + suffix(i) + '/{z}/{x}/{y}.png', tms=true)

            const iTime = new Date(currentTime.valueOf() - i * 60 * 1000)
            
            timeLayers.push({
                timestamp: `${timeString(iTime)} (-${i} min)`,
                tileLayer: layer
            });
        }
        return timeLayers;
    }
});

L.control.radar = function (options={}) {
    return new L.Control.Radar(options);
};

let inputedTraceroute = "";
let parsedTraceroute = [];
let ipData = {};
let ipDataArray = [];

// looks for IP in a line and returns NULL or IP
function parseIP(line) {
    const ipRegex = /\b(\d{1,3}\.){3}\d{1,3}\b/g;
    const match = line.match(ipRegex);
    return match ? match[0] : null;
}

// Parses inputed traceroute and returns array of IPs (NULL if no IP in line)
function parseTraceroute(tracerouteText) {
    const lines = tracerouteText.trim().split("\n");
    const ipList = lines.map(line => parseIP(line));
    return ipList;
}

// Checks if IP is private
function isPrivateIP(ip) {
    return ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.");
}

// Calls API and returns info for a given IP
async function lookupIP(ip) {
    const response = await fetch(`http://api.imjoseph.com/v1/ipinfo/${ip}`);
    const data = await response.json();
    return data;
}

// gets public IP info for the user and returns it as an object, or null if failed (used if "Include my own IP" is checked)
async function getPublicIP() {
    try {
        const response = await fetch("https://api.imjoseph.com/v1/ipinfo/self");
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to get public IP:", error);
        return null;
    }
}


// Icons for map
var startIcon = new L.Icon({
    iconUrl: '/assets/start.svg',
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});
var hopIcon = new L.Icon({
    iconUrl: '/assets/router.svg',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
});
var endIcon = new L.Icon({
    iconUrl: '/assets/finish.svg',
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});


// render map with Leaflet and draw lines between points in order of traceroute
function renderMap(ipDataArray) {
    if (window.mapInstance) {
        window.mapInstance.remove();
    }

    const map = L.map("map").setView([20, 0], 2);
    window.mapInstance = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    const points = [];

    for (const [index,info] of ipDataArray.entries()) {
        let lat = parseFloat(info.latitude);
        let lon = parseFloat(info.longitude);

        // Skip if lat/lon are missing, "Not found", or not valid numbers
        if (!info.latitude || !info.longitude || isNaN(lat) || isNaN(lon)) {
            console.log(`Skipping ${info.ip} - no valid coordinates`);
            continue;
        }


        const coords = [lat, lon];
        points.push(coords);

        if (index === 0) {
            currentIcon = startIcon;
        } else if (index === ipDataArray.length - 1) {
            currentIcon = endIcon;
        } else {
            currentIcon = hopIcon;
        }

        L.marker(coords, { icon: currentIcon}).addTo(map)
            .bindPopup(`
                <b>${index === 0 ? "Start" : index === ipDataArray.length - 1 ? "End" : `Hop ${index}`}</b><br>
                <b>${info.ip}</b><br>
                ${info.city || "Unknown City"}, ${info.country_name || ""}<br>
                ${info.as_entity || ""}<br>
                ASN: ${info.as || ""}
            `);
    }

    if (points.length > 1) {
        L.polyline(points, { color: "#ff8c00", weight: 3, dashArray: "10,10" }).addTo(map);
    }

    if (points.length > 0) {
        map.fitBounds(points);
    }
}

// Save inputed traceroute to variable inputedTraceroute
async function parseText() {
    inputedTraceroute = document.getElementById("tracerouteInput").value;
    parsedTraceroute = parseTraceroute(inputedTraceroute);
    ipData = {};
    ipDataArray = [];
    const ipList = document.getElementById("ipList");
    ipList.innerHTML = "";
    const includeSelf = document.getElementById("includeSelf").checked;

    // Build self IP list item if checkbox is checked
    let selfListItem = null;
    if (includeSelf) {
        const selfInfo = await getPublicIP();
        if (selfInfo && selfInfo.latitude && selfInfo.longitude) {
            ipDataArray.push({ ip: selfInfo.IPv4, ...selfInfo });
            ipData[selfInfo.IPv4] = selfInfo;

            selfListItem = document.createElement("li");
            const details = document.createElement("details");
            const summary = document.createElement("summary");
            summary.textContent = `${selfInfo.IPv4} (you)`;
            details.appendChild(summary);
            const infoList = document.createElement("ul");
            for (const [key, value] of Object.entries(selfInfo)) {
                const infoItem = document.createElement("li");
                infoItem.textContent = `${key}: ${value}`;
                infoList.appendChild(infoItem);
            }
            details.appendChild(infoList);
            selfListItem.appendChild(details);
        }
    }

    for (const ip of parsedTraceroute) {
        const listItem = document.createElement("li");

        if (ip === null) {
            listItem.textContent = "No IP found in this line";
        } else if (isPrivateIP(ip)) {
            listItem.textContent = `${ip} (private)`;
        } else {
            try {
                const info = await lookupIP(ip);
                ipData[ip] = info;
                ipDataArray.push({ ip, ...info });

                // Build dropdown
                const details = document.createElement("details");
                const summary = document.createElement("summary");
                summary.textContent = ip;
                details.appendChild(summary);
                const infoList = document.createElement("ul");
                for (const [key, value] of Object.entries(info)) {
                    const infoItem = document.createElement("li");
                    infoItem.textContent = `${key}: ${value}`;
                    infoList.appendChild(infoItem);
                }
                details.appendChild(infoList);
                listItem.appendChild(details);
            } catch (error) {
                console.error(`Failed to lookup IP ${ip}:`, error);
                listItem.textContent = `${ip} (lookup failed)`;
            }
        }

        ipList.appendChild(listItem);

        // Insert self IP after the first item
        if (selfListItem && ipList.children.length === 1) {
            ipList.appendChild(selfListItem);
        }
    }
    renderMap(ipDataArray);
}
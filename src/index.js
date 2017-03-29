const html = require('bel');
const ns = require('util-news-selectors');

const slice = Array.prototype.slice;

const COLOR_LINE = '#999';
const COLOR_MIN = '#0097AB';
const COLOR_MAX = '#FF6600';

if (!d3 || !c3) {
  throw new Error('Dependencies not loaded');
}

const teaserEls = slice.call(document.querySelectorAll(ns('embed:wysiwyg')) || [])
  .filter(el => el.querySelector('[data-interactive-debbie-tracker]'));

if (teaserEls.length === 0) {
  throw new Error('Beacon element not found');
}

const teaserEl = teaserEls[0];

const tableEls = slice.call(teaserEl.querySelectorAll('table'));

if (tableEls.length === 0) {
  throw new Error('Tables not found');
}

const places = [];

slice.call(tableEls[0].rows).forEach((row, rowIndex) => {
  const time = row.cells[0].innerHTML;

  slice.call(row.cells, 1).forEach((cell, colIndex) => {
    if (rowIndex === 0) {
      places.push({
        name: cell.innerHTML,
        slug: cell.innerHTML.toLowerCase().replace(' ', '-'),
        rainfalls: [],
        maxRainfall: -Infinity,
        latestRainfallIndex: 0
      });

      return;
    }

    const cellInt = parseInt(cell.innerHTML, 10);
    const value = isNaN(cellInt) ? null : cellInt;

    places[colIndex].rainfalls.push({time: time, value: value});

    if (value !== null && value >= places[colIndex].maxRainfall) {
      places[colIndex].maxRainfall = value;
    }

    if (value !== null) {
      places[colIndex].latestRainfallIndex = rowIndex - 1;
    }
  });

});

const meta = places.reduce((memo, place) => {
  if (memo.rainfallTimes == null) {
    memo.rainfallTimes = place.rainfalls.map(rainfall => rainfall.time);
  }

  if (place.maxRainfall > memo.maxRainfall) {
    memo.maxRainfall = place.maxRainfall;
  }

  return memo;
}, {
  maxRainfall: -Infinity
});

meta.rainfallColorScale = d3.scale.linear().domain([0, meta.maxRainfall])
  .interpolate(d3.interpolateHcl)
  .range([d3.rgb(COLOR_MIN), d3.rgb(COLOR_MAX)]);

const appEl = html`
  <div class="DebbieTracker">
    <div class="DebbieTracker-markers">
      <div class="DebbieTracker-marker" style="left: 5%">
        <div class="DebbieTracker-marker-label">${meta.rainfallTimes[0]}</div>
        <div class="DebbieTracker-marker-label">${meta.rainfallTimes[0]}</div>
      </div>
      <div class="DebbieTracker-marker" style="left: 49.25%">
        <div class="DebbieTracker-marker-label">${meta.rainfallTimes[Math.floor(meta.rainfallTimes.length / 2)]}</div>
        <div class="DebbieTracker-marker-label">${meta.rainfallTimes[Math.floor(meta.rainfallTimes.length / 2)]}</div>
      </div>
      <div class="DebbieTracker-marker" style="left: 93.75%">
        <div class="DebbieTracker-marker-label">${meta.rainfallTimes[meta.rainfallTimes.length - 1]}</div>
        <div class="DebbieTracker-marker-label">${meta.rainfallTimes[meta.rainfallTimes.length - 1]}</div>
      </div>
    </div>
    <div class="DebbieTracker-places">
      ${places.map(place => html`
        <div class="DebbieTracker-place">
          <h2 class="DebbieTracker-name">${place.name}</h2>
          <div class="DebbieTracker-rainfall"><div id="DebbieTracker-rainfall-${place.slug}"></div></div>
        </div>
      `)}
    </div>
  </div>
`;

teaserEl.parentElement.insertBefore(appEl, teaserEl);
teaserEl.parentElement.removeChild(teaserEl);

places.forEach((place, placeIndex) => {
  const chart = c3.generate({
    bindto: `#DebbieTracker-rainfall-${place.slug}`,
    size: {
        height: 85,
    },
    padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    },
    data: {
      columns: [
        ['Rainfall'].concat(place.rainfalls.map(rainfall => rainfall.value))
      ],
      type: 'area-spline',
      color: (color, d) => {
        if (!d.value) {
          return `url(#rainfall-gradient-${placeIndex})`;
        }

        return meta.rainfallColorScale(d.value);
      },
      labels: {
        format: {
          Rainfall: (d, _, i) => {
            if (i === place.latestRainfallIndex) {
              return `${d} mm`;
            }

            return '';
          }
        }
      }
    },
    tooltip: {
      format: {
        title: d => `${meta.rainfallTimes[d]}`,
        value: d => `${d} mm`
      }
    },
    axis: {
      y: {
        show: false,
        padding: {
          top: 33,
          bottom: 17
        },
        max: meta.maxRainfall,
        min: 0
      },
      x: {
        type: 'category',
        show: false,
        padding: {
          left: 1.5,
          right: 2
        },
        categories: meta.rainfallTimes
      }
    },
    legend: {
      show: false
    }
  });

  const gradient = d3.select(chart.element).select('defs').append('linearGradient')
    .attr('x1', '0%')
    .attr('y1', '100%')
    .attr('x2', '0%')
    .attr('y2', '0%')
    .attr('id', `rainfall-gradient-${placeIndex}`);

  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-opacity', 1)
    .attr('stop-color', meta.rainfallColorScale(0));

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-opacity', 1)
    .attr('stop-color', meta.rainfallColorScale(place.maxRainfall));

  setInterval(() => {
    d3.select(chart.element)
    .call(x => {
      x.selectAll('circle')
      .call(_d => {
        _d[0].forEach(d => {
          d3.select(d)
          .attr('r', c => {
            return c.index === place.latestRainfallIndex ? 4.5 : 0;
          })
          .style('opacity', c => {
            return c.index === place.latestRainfallIndex ? 1 : 0;
          });
        })
      });
      x.selectAll('clipPath').remove();
    });
  }, 250);
});

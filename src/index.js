const html = require('bel');
const ns = require('util-news-selectors');

const slice = Array.prototype.slice;

const COLOR_LINE = '#999';
const COLOR_MIN = '#007579';
const COLOR_MAX = '#df005d';
// const COLOR_MAX = '#F8076D';

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
  slice.call(row.cells).forEach((cell, colIndex) => {
    switch (rowIndex) {
      case 0:
        places.push({
          name: cell.innerHTML,
          slug: cell.innerHTML.toLowerCase().replace(' ', '-'),
          rainfall: 0,
          gusts: [],
          maxGust: -Infinity,
          minGust: Infinity,
        });
        break;
      case 1:
        places[colIndex].rainfall = cell.innerHTML === '-' ? null : +cell.innerHTML;
        break;
      default:
        break;
    }
  });
});

slice.call(tableEls[1].rows).forEach((row, rowIndex) => {
  const time = row.cells[0].innerHTML;

  slice.call(row.cells).forEach((cell, colIndex) => {
    if (rowIndex === 0 || colIndex === 0) {
      return;
    }

    const value = (+cell.innerHTML) || null;

    places[colIndex - 1].gusts.push({time: time, value: value});

    if (value !== null && value > places[colIndex - 1].maxGust) {
      places[colIndex - 1].maxGust = value;
    }

    if (value !== null && value < places[colIndex - 1].minGust) {
      places[colIndex - 1].minGust = value;
    }
  });

});

const meta = places.reduce((memo, place) => {
  if (memo.numGusts == null) {
    memo.numGusts = place.gusts.filter(gust => gust.value !== null).length;
    memo.gustTimes = place.gusts.map(gust => gust.time);
  }

  if (place.maxGust > memo.maxGust) {
    memo.maxGust = place.maxGust;
  }

  if (place.minGust < memo.minGust) {
    memo.minGust = place.minGust;
  }

  if (place.rainfall !== null && place.rainfall > memo.maxRainfall) {
    memo.maxRainfall = place.rainfall;
  }

  if (place.rainfall !== null && place.rainfall < memo.minRainfall) {
    memo.minRainfall = place.rainfall;
  }

  return memo;
}, {
  maxGust: -Infinity,
  minGust: Infinity,
  maxRainfall: -Infinity,
  minRainfall: Infinity
});

meta.gustColorScale = d3.scale.linear().domain([meta.minGust, meta.maxGust])
  .interpolate(d3.interpolateHcl)
  .range([d3.rgb(COLOR_MIN), d3.rgb(COLOR_MAX)]);

meta.rainfallColorScale = d3.scale.linear().domain([meta.minRainfall, meta.maxRainfall])
  .interpolate(d3.interpolateHcl)
  .range([d3.rgb(COLOR_MIN), d3.rgb(COLOR_MAX)]);

const appEl = html`
  <div class="DebbieTracker">
    <div class="DebbieTracker-markers">
      <div class="DebbieTracker-marker" style="left: 6%">
        <div class="DebbieTracker-marker-label">${meta.gustTimes[0]}</div>
      </div>
      <div class="DebbieTracker-marker" style="left: 49.25%">
        <div class="DebbieTracker-marker-label">${meta.gustTimes[Math.floor(meta.gustTimes.length / 2)]}</div>
      </div>
      <div class="DebbieTracker-marker" style="left: 92.75%">
        <div class="DebbieTracker-marker-label">${meta.gustTimes[meta.gustTimes.length - 1]}</div>
      </div>
    </div>
    <div class="DebbieTracker-places">
      ${places.map(place => html`
        <div class="DebbieTracker-place">
          <h2 class="DebbieTracker-name">${place.name}</h2>
          ${place.rainfall === null ? null : html`<div class="DebbieTracker-rainfall">
            <div class="DebbieTracker-rainfall-value" style="color: ${meta.rainfallColorScale(place.rainfall)}">${place.rainfall}</div>
            <div class="DebbieTracker-rainfall-units">mm</div>
            <div class="DebbieTracker-rainfall-context">rainfall since midnight</div>
          </div>`}
          <div class="DebbieTracker-gust"><div id="DebbieTracker-gust-${place.slug}"></div></div>
        </div>
      `)}
    </div>
  </div>
`;

teaserEl.parentElement.insertBefore(appEl, teaserEl);
teaserEl.parentElement.removeChild(teaserEl);

places.forEach(place => {
  const chart = c3.generate({
    bindto: `#DebbieTracker-gust-${place.slug}`,
    size: {
        height: 65,
    },
    padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    },
    data: {
      columns: [
        ['Gust'].concat(place.gusts.map(gust => gust.value))
      ],
      type: 'spline',
      color: (color, d) => {
        if (!d.value) {
          return COLOR_LINE;
        }

        return meta.gustColorScale(d.value);
      },
      labels: {
        format: {
          Gust: (d, i, e) => {
            if (e === meta.numGusts - 1) {
              return `${d} kph`;
            }

            // if (d === place.maxGust) {
            //   return `${d} kph`;
            // }

            return '';
          }
        }
      }
    },
    tooltip: {
      format: {
        title: d => `${meta.gustTimes[d]}`,
        value: d => `${d} kph`
      }
    },
    axis: {
      y: {
        show: false,
        padding: {
          top: 35,
          bottom: 5
        },
        max: meta.maxGust,
        min: meta.minGust
      },
      x: {
        type: 'category',
        show: false,
        padding: {
          left: 1.5,
          right: 2
        },
        categories: meta.gustTimes
      }
    },
    legend: {
      show: false
    }
  });

  setInterval(() => {
    d3.select(chart.element)
    .call(x => {
      x.selectAll('circle')
      .call(_d => {
        _d[0].forEach(d => {
          d3.select(d)
          .style('opacity', c => {
            // return (c.value === place.maxGust || c.x === meta.numGusts - 1) ? 1 : 0;
            return c.x === meta.numGusts - 1 ? 1 : 0;
          });
        })
      });
      x.selectAll('clipPath').remove();
    });
  }, 250);
});

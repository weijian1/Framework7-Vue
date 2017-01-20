import {resolve} from 'universal-router';
import {parse} from 'query-string';

const getTabChildRoutes = (originalRoute) => {
  const tabs = originalRoute.tabs;

  return tabs.map(tab => {      
    const children = !tab.routes ? null : (() => {
      return tab.routes.map(route => {
        return {
          path: route.path,
          action: (context) => {
            return {
              pagePath: originalRoute.path,
              pageComponent: originalRoute.component,
              activeTab: {
                path: tab.path,
                tabId: tab.tabId,
                component: route.component
              },
              params: context.params
            };
          }
        };
      });
    })();

    return {
      path: tab.path,
      action: (children) ? null : (context) => {
        return {
          pagePath: originalRoute.path,
          pageComponent: originalRoute.component,
          activeTab: tab,
          params: context.params
        }        
      },
      children
    };
  });
};

const getRouteChildren = (originalRoute) => {
  if (originalRoute.tabs) {
    return getTabChildRoutes(originalRoute);
  } else {
    return null;
  }  
};

const convertRoutesToUniversalRouter = (originalRoutes) => {
  return originalRoutes.map(originalRoute => {
    const path = originalRoute.path;

    const children = getRouteChildren(originalRoute);
    
    const action = (children) ? null : (context) => {
      return {
        pagePath: originalRoute.path,
        pageComponent: originalRoute.component,
        params: context.params
      };
    };    

    return { path, action, children };    
  });
};

const findMatchingRoute = (routes, location) => {  
  return resolve(routes, {
    path: location.pathname,
    hash: location.hash,
    query: location.search
  });
};

function handleRouteChangeFromFramework7(view, options, changeRouteCallback) {
  if (!view.allowPageChange) return false;

  var url = options.url;
  var pageElement = options.pageElement;

  if (url && pageElement || !url || url === '#') {
    return true;
  }

  var inHistory = view.history.indexOf(url) >= 0;
  var inDomCache = view.pagesCache[url];

  if (inHistory && inDomCache) return true;  

  if (options.isBack) {
    changeRouteCallback(url, 'POP')
  } else {
    changeRouteCallback(url, 'PUSH');
  }

  return false;
}

export default class Framework7Router {
  constructor(originalRoutes, framework7) {
    this.routeChangeHandler = null;    
    this.routes = convertRoutesToUniversalRouter(originalRoutes);
    this.framework7 = framework7;

    //Hook router into Framework7 routing events
    const initialPreroute = framework7.params.preroute;

    framework7.params.routes = originalRoutes;
    framework7.params.routerRemoveTimeout = true;
    framework7.params.preroute = (view, options) => {
      var passToVueRouter = true;

      if (initialPreroute) {
        passToVueRouter = initialPreroute(view, options);
      }

      if (passToVueRouter) {
        return handleRouteChangeFromFramework7(view, options, this.changeRoute.bind(this));
      } else {
        return false;
      }
    };
  }

  setRouteChangeHandler(routeChangeHandler) {        
    this.routeChangeHandler = routeChangeHandler;
  }

  changeRoute(url, action) {
    const getMainView = () => this.framework7.views && this.framework7.views.reduce((mainView, nextView) => {
        if (nextView.main) {
            return nextView;
        } else {
            return mainView;
        }
    }, null); 

    const location = new URL(url, 'http://framework7/');

    findMatchingRoute(this.routes, location).then(matchingRoute => {
      console.log(matchingRoute);

      this.routeChangeHandler(
        Object.assign({}, matchingRoute, {
          view: getMainView(),
          query: parse(location.search),
          hash: location.hash,
          url: url,
          route: matchingRoute.pagePath,
          path: location.pathname                  
        })
      )
    });
  }
}
'use strict';

angular
  .module('angular-syncronizer', [])

  /*@ngInject*/
  .factory('Syncronizer', (_, URI, $q, Utils) => {
    const compileUrl = (url, urlParams, search, trailing, prepareParam) => {
      let urlParamsLength = 0;
      const srcUrl = String(url);

      url = srcUrl
        .replace(/%7D/g, '}')
        .replace(/%7B/g, '{')
        .replace(/\{([^}]+)}/g, ($0, name) => {
          urlParamsLength++;

          if (!urlParams.hasOwnProperty(name)) {
            throw new ReferenceError(`param "${name}" is not specified for url "${srcUrl}"`);
          }

          if (urlParams[name] == null) {
            throw new ReferenceError(`url param "${name}" is undefined for url "${srcUrl}"`);
          }

          return prepareParam(name, urlParams[name]);
        });

      const urlParamKeys = _.keys(urlParams);

      if (urlParamKeys.length !== urlParamsLength) {
        throw new Error(`there are unexpected url params [${urlParamKeys.join(',')}] for url "${srcUrl}"`);
      }

      const parsedUrl = URI(url);

      parsedUrl.addSearch(search);

      parsedUrl.path(parsedUrl.path().replace(/\/?$/, trailing ? '/' : ''));

      return parsedUrl.toString();
    };

    const compileParams = (syncParams, newSyncParams) => {
      syncParams = _.merge({}, syncParams, newSyncParams);

      syncParams.url = compileUrl(syncParams.url, syncParams.urlParams, syncParams.search, syncParams.trailing, syncParams.prepareParam);

      return syncParams;
    };

    const compileAjaxParams = (method, data, syncParams) => {
      const ajaxParams = {
        ...syncParams.requestProviderOptions,
        url: syncParams.url,
        $syncID: syncParams.$syncID,
        headers: syncParams.headers,
        method: method.toUpperCase()
      };

      if (!_.isUndefined(data)) {
        ajaxParams.data = syncParams.prepareData(data);
      }

      return ajaxParams;
    };

    const prepareCacheRequest = (cachedResponse) => {
      const newResponse = _.cloneDeep(cachedResponse);

      Utils.hiddenProperty(newResponse, '$meta', _.cloneDeep(cachedResponse.$meta));
      Utils.hiddenProperty(newResponse, '$error', _.cloneDeep(cachedResponse.$error));

      return newResponse;
    };

    const dataPipe = (method, syncParams, response, data) => {
      data = data || {};

      return $q.resolve(syncParams.prepare(data, response))
        .then((data) => {
          if (data == null) {
            return {};
          }

          return data;
        })
        .then((data) => {
          if (method === 'GET') {
            return syncParams.prepareGET(data, response);
          }

          if (method === 'PUT') {
            return syncParams.preparePUT(data, response);
          }

          if (method === 'POST') {
            return syncParams.preparePOST(data, response);
          }

          if (method === 'PATCH') {
            return syncParams.preparePATCH(data, response);
          }

          if (method === 'DELETE') {
            return syncParams.prepareDELETE(data, response);
          }

          throw new Error(`invalid method "${method}"`);
        })
        .then((data) => {
          if (data == null) {
            return {};
          }

          return data;
        });
    };

    const prepareResponse = (ajaxParams, syncParams, response, data, error) =>
      dataPipe(ajaxParams.method, syncParams, response, data)
        .then((data) => {
          const meta = _.omit(response, [ 'data' ]);

          /**
           * @var {Object} meta
           * @property {Number} status
           * @property {Object} config
           * @property {String} statusText
           * @property {Object} headers
           **/

          meta.$syncID = syncParams.$syncID;

          meta.status = Number(meta.status);

          Utils.hiddenProperty(data, '$meta', meta); // TODO: remove it, add real $meta prop
          Utils.hiddenProperty(data, '$error', error); // TODO: remove it, add real $error prop

          return data;
        });

    const request = (method, data, syncParams) => {
      const ajaxParams = compileAjaxParams(method, data, syncParams);

      return syncParams.requestProvider(ajaxParams)
        .then(
          (response) => prepareResponse(ajaxParams, syncParams, response, response.data, null),
          (response) => prepareResponse(ajaxParams, syncParams, response, {}, response.data)
            .then((rejection) => $q.reject(rejection))
        );
    };

    const Sync = (syncParams = {}) => {
      syncParams = _.merge({
        url: '',
        requestProvider: null,
        requestProviderOptions: {},
        search: {},
        headers: {},
        trailing: false,
        urlParams: {},
        cacheTimeGET: 2000,
        prepareData: (data) => data,
        prepareParam: (name, value) => value,
        prepare: (data, response) => data,
        preparePUT: (data, response) => data,
        prepareGET: (data, response) => data,
        preparePOST: (data, response) => data,
        preparePATCH: (data, response) => data,
        prepareDELETE: (data, response) => data,
        cacheHashParamsGET: [ 'url', 'headers', 'prepare', 'prepareGET' ]
      }, syncParams, { $syncID: Utils.uniqId() });

      const cachePromiseRegister = Utils.Register();

      const sync = (newSyncParams) =>
        Sync(_.merge({}, syncParams, newSyncParams));

      sync.uri = (segment) => { // shortcut
        const url = URI(syncParams.url);

        url.path(url.path().replace(/\/?$/, '/') + segment.replace(/^\//, '').replace(/\/$/, ''));

        return sync({ url: url.toString() });
      };

      sync.isRequest = (requestOrConfig) =>
      requestOrConfig && requestOrConfig.$syncID === syncParams.$syncID;

      sync.set = (newSyncParams) => sync(newSyncParams);

      sync.cacheClean = () => {
        cachePromiseRegister.cleanUpAll();
      };

      sync.get = (newSyncParams) => {
        newSyncParams = compileParams(syncParams, newSyncParams);

        const hash = Utils.hash(_.pick(newSyncParams, newSyncParams.cacheHashParamsGET));

        return Utils.cache(cachePromiseRegister, hash, newSyncParams.cacheTimeGET,
          () => request('get', undefined, newSyncParams),
          (cachedResponse) => prepareCacheRequest(cachedResponse)
        );
      };

      sync.put = (data, newSyncParams) => request('put', data, compileParams(syncParams, newSyncParams)); // TODO: remove this public method
      sync.post = (data, newSyncParams) => request('post', data, compileParams(syncParams, newSyncParams)); // TODO: remove this public method
      sync.patch = (data, newSyncParams) => request('patch', data, compileParams(syncParams, newSyncParams)); // TODO: remove this public method
      sync.delete = (newSyncParams) => request('delete', undefined, compileParams(syncParams, newSyncParams)); // TODO: remove this public method

      sync.request = (urlParams, search, headers) => { // shortcut // TODO: remove this public method
        const actions = {};
        const newSyncParams = { urlParams: urlParams || {}, search: search || {}, headers: headers || {} };

        actions.put = (data) => sync.put(data, newSyncParams); // TODO: remove this public method
        actions.get = () => sync.get(newSyncParams); // TODO: remove this public method
        actions.post = (data) => sync.post(data, newSyncParams); // TODO: remove this public method
        actions.patch = (data) => sync.patch(data, newSyncParams); // TODO: remove this public method
        actions.delete = () => sync.delete(newSyncParams); // TODO: remove this public method

        return actions;
      };

      return sync;
    };

    return Sync;
  });

export default 'angular-syncronizer';

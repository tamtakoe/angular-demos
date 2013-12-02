define("modules/tv/controllers/edit", [

    'underscore',
    'app',
    'lib/controller',
    'modules/common/views/popup',
    'modules/tv/views/edit/popup',
    'modules/tv/views/upload/popup',
    'modules/video/models/video',
    'modules/common/models/current-user',
    'modules/common/views/flash-message'

], function(_, app, Controller, popupView, EditPopupView, UploadPopupView, Video, currentUser, flashMessageView) {
    'use strict';

    return Controller.extend({
        edit: {
            before: [ '_checkManager' ],
            action: function(params) {
                var video = new Video({ id: params.id });

                var deferred = video.fetch();

                var editPopup = new EditPopupView({ nested: { model: video, videoPromise: deferred.promise() }});

                popupView.open(editPopup, 'popup-videoEdit');
            }
        },

        upload: {
            before: [ '_checkManager' ],
            action: function() {
                var video = new Video();

                var uploadPopup = new UploadPopupView({ nested: { model: video }});

                popupView.open(uploadPopup, 'popup-videoUpload');
            }
        },

        _checkManager: function(params) {
            var deferred = this.getDeferred();

            currentUser.isTvManager().done(function() {
                deferred.resolve();
            }).fail(function(){
                    flashMessageView.error('flashMessage_accessDenied_title',
                        "flashMessage_accessDenied_description");
            });
       }
    });
});
define("modules/tv/controllers/tv", [

    'underscore',
    'app',
    'lib/controller',
    'lib/history/page',
    'modules/tv/views/tv/navigation/navigation',
    'modules/tv/views/tv/main',
    'modules/tv/views/tv/list/categories/categories',
    'modules/video/views/list/list',
    'modules/tv/views/tv/list/search-results/results',
    'modules/video/collections/categories',
    'modules/video/collections/videos',
    'modules/common/controllers/actions/get-city',
    'modules/tv/views/tv/upload-button',
    'modules/common/models/current-user',
    'modules/tv/views/tv/featured'

], function(_, app, Controller, pageHistory, NavigationView, MainView, CategoriesView, ListView, SearchResultsView, Categories, Videos, __getCityAction, UploadButtonView, currentUser, FeaturedView) {
    'use strict';

    return Controller.extend({
        before: [ __getCityAction ],

        initialize: function() {
            app.getModule('tv').getRegion('main').show(new MainView());

            this._categories = new Categories();
            this._categoriesDeferred = this._categories.fetch();

            this._navigationView = null;
            this._searchInputView = null;
            this._searchParams = null;
            this._categoriesSearchRequest = null;
            this._allSearchRequest = null;

            this._isModeratorChecked = false;

            this.listenTo(currentUser, 'logout login', _.bind(function() {
                this.__addUploadButton(true);
            }, this));
        },

        index: {
            before: [ '__createNavigation' ],
            action: function(params) {
                // TODO: Мы здесь ждем категории и навигацию хотя она нам не нужна. Нужно какой-то вариант вызова экшенов без ожидания, но чтобы тоже в стэк попадали

                var videos = new Videos();
                var featuredView = new FeaturedView({ collection: videos });

                app.getModule('tv').getRegion('main.featured').show(featuredView);


                var categoriesView = new CategoriesView({
                    city: params.city,
                    categories: this._categories
                });

                app.getModule('tv').getRegion('main.list').show(categoriesView);
            }
        },

        section: {
            before: [ '__createNavigation' ],
            action: function(params) {
                var listView = new ListView({
                    city: params.city,
                    category: params.category,
                    tag: params.tag
                });

                app.getModule('tv').getRegion('main.list').show(listView);
            }
        },

        tag: {
            before: [ '__createNavigation' ],
            action: function(params) {
                var listView = new ListView({
                    city: params.city,
                    tag: params.tag
                });

                app.getModule('tv').getRegion('main.list').show(listView);
            }
        },

        popular: {
            before: [ '__createNavigation' ],
            action: function(params) {
                var listView = new ListView({
                    city: params.city,
                    sort: 'popularity desc',
                    title: 'popular_videos'
                });

                app.getModule('tv').getRegion('main.list').show(listView);
            }
        },

        newVideos: {
            before: [ '__createNavigation' ],
            action: function(params) {
                var listView = new ListView({
                    city: params.city,
                    sort: 'date desc',
                    title: 'new_videos'
                });

                app.getModule('tv').getRegion('main.list').show(listView);
            }
        },

        search: {
            before: [ '__createNavigation' ],
            action: function(params) {
                this._search(params.search, true);
            }
        },

        __createNavigation: {
            before: [ '__getCategories', '__addUploadButton' ],
            action: function(params) {
                if (!this._navigationView) {
                    this._navigationView = new NavigationView({
                        collection: this._categories,
                        city: params.city,
                        category: params.category,
                        tag: params.tag,

                        nested: {
                            search: params.search
                        }
                    });

                    app.getModule('tv').getRegion('main.navigation').show(this._navigationView);

                    this._searchInputView = this._navigationView.getRegion('searchInput').currentView;
                    this._searchInputView.on('input', _.bind(this._search, this));
                } else {
                    if (!params.search) {
                        this._searchInputView.clearInput();
                    }


                    this._navigationView.changeCurrent(params.category, params.tag);
                }

                app.getModule('tv').getRegion('main.featured').remove();

                this._searchParams = params;
            }
        },

        _search: function(query, skipNavigate) {
            var backUrl;
            var searchUrl;
            var deferred;
            var categoryResults;
            var categoryFetchData;
            var allResults;
            var allFetchData = {
                cityId: this._searchParams.city.get('id'),
                search: query,
                limit: 50,
                _fields: 'id,title,file(cover),category,date,photoReport(place(title,url))'
            };

            backUrl = '/' + this._searchParams.city.get('urlName') + '/tv';
            if (this._searchParams.category) {
                backUrl += '/' + this._searchParams.category.get('urlName');
            }
            if (this._searchParams.tag) {
                backUrl += '/' + this._searchParams.tag.get('urlName');
            }

            if (query === '') {
                pageHistory.navigate(backUrl, { trigger: true });
                return false;
            }

            searchUrl = backUrl + '/search/' + encodeURIComponent(query);

            this._searchInputView.showLoading();

            if (this._searchParams.category) {
                categoryResults = new Videos();
                allResults = new Videos();

                categoryFetchData = _.clone(allFetchData);
                categoryFetchData.categoryId = this._searchParams.category.get('id');
                categoryFetchData._fields = 'id,title,file(cover),date,photoReport(place(title,url))';

                if (this._categoriesSearchRequest) {
                    this._categoriesSearchRequest.abort();
                }

                deferred = this._categoriesSearchRequest = categoryResults.fetch({ data: categoryFetchData});

                categoryResults.on('reached', function(){
                    allResults.fetch({ data: allFetchData});
                });
            } else {
                allResults = new Videos();

                if (this._allSearchRequest) {
                    this._allSearchRequest.abort();
                }

                deferred = this._allSearchRequest = allResults.fetch({ data: allFetchData});
            }

            deferred.done(_.bind(function() {
                var searchResultsView = new SearchResultsView({
                    allResults: allResults,
                    allFetchData: allFetchData,
                    categoryResults: categoryResults,
                    categoryFetchData: categoryFetchData,
                    category: this._searchParams.category,
                    backUrl: backUrl
                });

                if (!skipNavigate) {
                    pageHistory.navigate(searchUrl, { trigger: false });
                }

                this._searchInputView.hideLoading();

                app.getModule('tv').getRegion('main.list').show(searchResultsView);
            }, this));
        },

        __getCategories: function(params) {
            var self = this;
            var deferred = this.getDeferred();
            this._categoriesDeferred.done(function() {
                if (params.categoryUrlName) {
                    params.category = self._categories.find(function(model) {
                        return model.get('urlName') === params.categoryUrlName;
                    });

                    if (!params.category) {
                        throw 'Wrong category';
                        // TODO: 404
                    }
                }

                if (params.category && params.tagUrlName) {
                    params.tag = params.category.get('tags').find(function(model) {
                        return model.get('urlName') === params.tagUrlName;
                    });

                    if (!params.tag) {
                        throw 'Wrong tag';
                        // TODO: 404
                    }
                } else if (params.tagUrlName) {
                    params.tag = self._categories.find(function(category) {
                        return category.get('tags').find(function(tag) {
                            return tag.get('urlName') === params.tagUrlName;
                        });
                    });

                    if (!params.tag) {
                        throw 'Wrong tag';
                        // TODO: 404
                    }
                }

                deferred.resolve();
            });
        },

        __addUploadButton: function(isForce) {
            if (!isForce && this._isModeratorChecked) {
                return;
            }

            this._isModeratorChecked = true;

            currentUser.isTvManager()
                .done(function() {
                    var uploadButtonView = new UploadButtonView();
                    app.getModule('tv').getRegion('main.uploadButton').show(uploadButtonView);
                })
                .fail(function() {
                    app.getModule('tv').getRegion('main.uploadButton').remove();
                });
        }
    });
});
define("modules/tv/locales/compiled/ru", {"tv_title": "Geometria TV", "beta_title": "Бета-версия", "navigation_all": "Все", "see_all": "Смотреть все", "all": "все", "see_all_count": function(MessageFormat, data) {return (function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["count"];
r += " видео";
return r;
})(data)}, "see_all_video": "видео", "new_videos": "Новые видео", "popular_videos": "Популярные видео", "albums_videos": "Репортажи", "search_input_placeholder": "Поиск видео", "recommended": "Геометрия рекомендует", "back_to_video_list": "Назад к списку видео", "found_video": function(MessageFormat, data) {return (function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["count"];
r += " видео";
return r;
})(data)}, "not_found_video": "Ничего не найдено", "found_all_video_from_category": function(MessageFormat, data) {return (function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["count"];
r += " видео в других категориях";
return r;
})(data)}, "searching_all_video_from_category": "Поиск видео в других категориях", "not_found_all_video_from_category": "Ничего не найдено в других категориях", "found_category_video_from_category": function(MessageFormat, data) {return (function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["count"];
r += " видео в категории ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["category"];
return r;
})(data)}, "not_found_category_video_from_category": function(MessageFormat, data) {return (function(d){
var r = "";
r += "Ничего не найдено в категории ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["category"];
return r;
})(data)}, "save": "Сохранить", "add_video": "Добавить видео", "save_video": "Опубликовать", "adding_video": "Добавление видео", "title": "Название", "date": "Дата", "description": "Описание", "category": "Раздел", "choose_category": "Выберите раздел", "tags": "Категории", "choose_tags": "Выберите категории", "link_with_event": "Связать с фотоотчётом", "link_to_event": "Ссылка на фотоотчёт", "origin_city": "Город, где снят репортаж", "choose_city": "Укажите город", "choose_cities": "Укажите список городов", "fixed_in_cities": "Закреплен на городах", "video_publish_success": "Видео успешно опубликовано", "video_change_success": "Видео успешно изменено", "video_change_error": "При сохранении произошла ошибка", "loading": "Загружается", "select_file": "Выбрать файл", "replace_file": "Заменить видео-файл", "select_another_file": "Выбрать другой файл", "size_limit_error": function(MessageFormat, data) {return (function(d){
var r = "";
r += "Размер файла больше ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["size"];
r += " ГБ";
return r;
})(data)}, "file_type_error": function(MessageFormat, data) {return (function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["type"];
r += "-файлы не поддерживаются";
return r;
})(data)}, "file_characteristics": "Соотношение сторон 16:9, размер до 3 ГБ", "load_successfull": "успешно загружен", "publish": "Oпубликовать", "network_error": "Ошибка сети", "try_again": "Попробовать еще раз", "publish_error": "Ошибка публикации", "101_upload_error_message": "Размер файла больше 3 ГБ", "101_upload_error_link_text": "Выбрать другой файл", "102_upload_error_message": "Превышена максимальная длительность видео", "102_upload_error_link_text": "Выбрать другой файл", "103_upload_error_message": "Высота фидео должна быть больше 360", "103_upload_error_link_text": "Выбрать другой файл", "104_upload_error_message": "Системная ошибка", "confirm_video_close": "Имеются несохраненные данные. Продолжить?", "is_recommended": "Геометрия рекомендует", "is_featured": "Закрепить", "previous_month": "Предыдущий месяц", "next_month": "Следующий месяц", "january": "Январь", "february": "Февраль", "march": "Март", "april": "Апрель", "may": "Май", "june": "Июнь", "july": "Июль", "august": "Август", "september": "Сеньтябрь", "october": "Октябрь", "november": "Ноябрь", "december": "Декабрь", "monday": "Понедельник", "tuesday": "Вторник", "wednesday": "Среда", "thursday": "Четверг", "friday": "Пятница", "saturday": "Суббота", "sunday": "Воскресенье", "mon": "Пн", "tue": "Вт", "wed": "Ср", "thu": "Чт", "fri": "Пт", "sat": "Сб", "sun": "Вс"});
define("modules/tv/templates/compiled/edit/popup", ["lib/style!modules/tv/styles/compiled/tv/main", require, "lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n<article class=\"videoEdit\">\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "videoUpload", options) : helperMissing.call(depth0, "region", "videoUpload", options)))
    + "\n    <section class=\"popup-body\">\n        <h2 class=\"popup-title\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "adding_video", options) : helperMissing.call(depth0, "t", "adding_video", options)))
    + "</h2>\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "videoForm", options) : helperMissing.call(depth0, "region", "videoForm", options)))
    + "\n    </section>\n</article>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/edit/video-form", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function", escapeExpression=this.escapeExpression, helperMissing=helpers.helperMissing, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n    <input name=\"file[id]\" value=\"";
  stack1 = helpers['if'].call(depth0, depth0.file, {hash:{},inverse:self.noop,fn:self.program(2, program2, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\" id=\"f-fileId\" type=\"hidden\"/>\n    <div class=\"form-row\">\n        <span class=\"field j-field\">\n            <input type=\"text\" name=\"date\" class=\"j-date-field\" value=\"";
  stack1 = helpers['if'].call(depth0, depth0.date, {hash:{},inverse:self.noop,fn:self.program(4, program4, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\" autocomplete=\"off\" id=\"f-video-date\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "date", options) : helperMissing.call(depth0, "t", "date", options)))
    + "\">\n        </span>\n    </div>\n    <div class=\"form-row\">\n        <span class=\"field j-field\">\n            <input type=\"text\" name=\"title\" value=\"";
  if (stack2 = helpers.title) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.title; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "\" id=\"f-video-title\" autocomplete=\"off\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "title", options) : helperMissing.call(depth0, "t", "title", options)))
    + "\">\n        </span>\n    </div>\n    <div class=\"form-row videoForm-row-textarea\">\n        <span class=\"field j-field\">\n            <textarea type=\"text\" class=\"j-description-field\" name=\"description\" id=\"f-video-description\" autocomplete=\"off\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "description", options) : helperMissing.call(depth0, "t", "description", options)))
    + "\" >";
  if (stack2 = helpers.description) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.description; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "</textarea>\n        </span>\n    </div>\n    <div class=\"form-row form-half-row-wrapper videoForm-row-selects\">\n        <div class=\"form-half-row\">\n            <label for=\"f-video-category\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "category", options) : helperMissing.call(depth0, "t", "category", options)))
    + "</label>\n            <div class=\"field j-field\">\n                <select name=\"category[id]\" value=\"\" id=\"f-video-category\" data-value=\"";
  stack2 = helpers['if'].call(depth0, depth0.category, {hash:{},inverse:self.noop,fn:self.program(6, program6, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\" class=\"j-select-section select-section\" autocomplete=\"off\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "choose_category", options) : helperMissing.call(depth0, "t", "choose_category", options)))
    + "\">\n                    <option value=\"\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "choose_category", options) : helperMissing.call(depth0, "t", "choose_category", options)))
    + "</option>\n                    ";
  stack2 = helpers.each.call(depth0, depth0.categories, {hash:{},inverse:self.noop,fn:self.program(8, program8, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                </select>\n            </div>\n        </div>\n        <div class=\"form-half-row\">\n            <label for=\"f-video-tags\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "tags", options) : helperMissing.call(depth0, "t", "tags", options)))
    + "</label>\n            <div class=\"field j-field\">\n                <select name=\"tags[][id]\" value=\"\" id=\"f-video-tags\" data-value=\"";
  if (stack2 = helpers.tags) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.tags; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "\" data-error-position=\"right\" class=\"j-select-category select-category\" multiple ";
  stack2 = helpers.unless.call(depth0, depth0.tags, {hash:{},inverse:self.noop,fn:self.program(10, program10, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += " autocomplete=\"off\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "choose_tags", options) : helperMissing.call(depth0, "t", "choose_tags", options)))
    + "\">\n                    <option value=\"\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "choose_tags", options) : helperMissing.call(depth0, "t", "choose_tags", options)))
    + "</option>\n                </select>\n            </div>\n        </div>\n    </div>\n    <div class=\"form-row videoForm-row-select\">\n        <label for=\"f-video-originCity\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "origin_city", options) : helperMissing.call(depth0, "t", "origin_city", options)))
    + "</label>\n        <div class=\"field j-field\">\n            <select name=\"originCity[id]\" value=\"\" id=\"f-video-originCity\" data-value=\"";
  stack2 = helpers['if'].call(depth0, depth0.originCity, {hash:{},inverse:self.noop,fn:self.program(12, program12, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\" class=\"j-select-originCity select-section\" autocomplete=\"off\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "choose_city", options) : helperMissing.call(depth0, "t", "choose_city", options)))
    + "\">\n                <option value=\"\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "choose_city", options) : helperMissing.call(depth0, "t", "choose_city", options)))
    + "</option>\n                ";
  stack2 = helpers.each.call(depth0, depth0.cityArray, {hash:{},inverse:self.noop,fn:self.program(14, program14, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n            </select>\n        </div>\n    </div>\n    <div class=\"form-row videoForm-row-select\">\n        <label for=\"f-video-cities\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "fixed_in_cities", options) : helperMissing.call(depth0, "t", "fixed_in_cities", options)))
    + "</label>\n        <div class=\"field j-field\">\n            <select name=\"cities[][id]\" value=\"\" id=\"f-video-cities\" data-value=\"";
  if (stack2 = helpers.cities) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.cities; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "\" class=\"j-select-cities select-section\" multiple autocomplete=\"off\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "choose_cities", options) : helperMissing.call(depth0, "t", "choose_cities", options)))
    + "\">\n                <option value=\"\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "choose_cities", options) : helperMissing.call(depth0, "t", "choose_cities", options)))
    + "</option>\n                ";
  stack2 = helpers.each.call(depth0, depth0.cityArray, {hash:{},inverse:self.noop,fn:self.program(14, program14, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n            </select>\n        </div>\n    </div>\n    <div class=\"form-row form-row-inline videoForm-row-recommended\">\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "checkbox", depth0.isRecommendedCheckboxOptions, options) : helperMissing.call(depth0, "region", "checkbox", depth0.isRecommendedCheckboxOptions, options)))
    + "\n    </div>\n    <div class=\"form-row form-row-inline videoForm-row-featured\">\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "checkbox", depth0.isFeaturedCheckboxOptions, options) : helperMissing.call(depth0, "region", "checkbox", depth0.isFeaturedCheckboxOptions, options)))
    + "\n    </div>\n    <div class=\"form-row videoForm-row-linkWithReport\">\n        <label class=\"j-link-with-report link-with-report ";
  stack2 = helpers['if'].call(depth0, depth0.photoReport, {hash:{},inverse:self.noop,fn:self.program(16, program16, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\" for=\"f-video-photoReportId\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "link_with_event", options) : helperMissing.call(depth0, "t", "link_with_event", options)))
    + "</label>\n        <span class=\"field j-field j-reportField reportField ";
  stack2 = helpers.unless.call(depth0, depth0.photoReport, {hash:{},inverse:self.noop,fn:self.program(18, program18, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\">\n            <input type=\"text\" name=\"photoReport[id]\" id=\"f-video-photoReportId\" value=\""
    + escapeExpression(((stack1 = ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" autocomplete=\"off\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "link_to_event", options) : helperMissing.call(depth0, "t", "link_to_event", options)))
    + "\">\n            <span class=\"link-with-report-clear j-link-with-report-clear\"></span>\n        </span>\n    </div>\n    ";
  stack2 = helpers.unless.call(depth0, depth0.isNew, {hash:{},inverse:self.noop,fn:self.program(20, program20, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n";
  return buffer;
  }
function program2(depth0,data) {
  
  var stack1;
  return escapeExpression(((stack1 = ((stack1 = depth0.file),stack1 == null || stack1 === false ? stack1 : stack1.id)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1));
  }

function program4(depth0,data) {
  
  var stack1, options;
  options = {hash:{
    'format': ("D.M.YYYY")
  },data:data};
  return escapeExpression(((stack1 = helpers.date || depth0.date),stack1 ? stack1.call(depth0, depth0.date, options) : helperMissing.call(depth0, "date", depth0.date, options)));
  }

function program6(depth0,data) {
  
  var stack1;
  return escapeExpression(((stack1 = ((stack1 = depth0.category),stack1 == null || stack1 === false ? stack1 : stack1.id)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1));
  }

function program8(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                        <option value=\"";
  if (stack1 = helpers.id) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">";
  if (stack1 = helpers.name) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.name; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</option>\n                    ";
  return buffer;
  }

function program10(depth0,data) {
  
  
  return "disabled";
  }

function program12(depth0,data) {
  
  var stack1;
  return escapeExpression(((stack1 = ((stack1 = depth0.originCity),stack1 == null || stack1 === false ? stack1 : stack1.id)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1));
  }

function program14(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                    <option value=\"";
  if (stack1 = helpers.id) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">";
  if (stack1 = helpers.title) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.title; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</option>\n                ";
  return buffer;
  }

function program16(depth0,data) {
  
  
  return "active";
  }

function program18(depth0,data) {
  
  
  return "hidden";
  }

function program20(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n    <div class=\"form-row\">\n        <input type=\"submit\" class=\"submit j-save\" value=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "save", options) : helperMissing.call(depth0, "t", "save", options)))
    + "\">\n    </div>\n    ";
  return buffer;
  }

function program22(depth0,data) {
  
  
  return "\n    <span class=\"preloader preloader-25\"></span>\n";
  }

  buffer += "\n\n    ";
  stack1 = helpers['if'].call(depth0, depth0.isFetched, {hash:{},inverse:self.program(22, program22, data),fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  return buffer;
  }};});
define("modules/tv/templates/compiled/edit/video-upload", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n\n<input id=\"fileupload\" type=\"file\" name=\"file\" class=\"videoEdit-input j-videoEdit-input\">\n<footer class=\"popup-footer popup-footer-select j-videoEdit-select\">\n    <p class=\"comment j-message\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "file_characteristics", options) : helperMissing.call(depth0, "t", "file_characteristics", options)))
    + "</p>\n    <h2><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "select_file", options) : helperMissing.call(depth0, "t", "select_file", options)))
    + "</span></h2>\n</footer>\n\n<footer class=\"popup-footer popup-footer-replace j-videoEdit-replace\">\n    <p class=\"comment j-message\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "file_characteristics", options) : helperMissing.call(depth0, "t", "file_characteristics", options)))
    + "</p>\n    <h2><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "replace_file", options) : helperMissing.call(depth0, "t", "replace_file", options)))
    + "</span></h2>\n</footer>\n\n<footer class=\"popup-footer popup-footer-progress j-videoEdit-progress\">\n    <div class=\"popup-footer-progressLine j-progressLine\"></div>\n    <div class=\"popup-footer-progressText j-progressText\">0%</div>\n    <div class=\"popup-footer-progressComment \">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loading", options) : helperMissing.call(depth0, "t", "loading", options)))
    + "<br/><span class=\"j-message\"></span></div>\n</footer>\n\n<footer class=\"popup-footer popup-footer-error j-videoEdit-error\">\n    <h2 class=\"j-message\"></h2>\n    <p class=\"comment\"><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "try_again", options) : helperMissing.call(depth0, "t", "try_again", options)))
    + "</span></p>\n</footer>\n\n<footer class=\"popup-footer popup-footer-error popup-footer-publishError j-videoEdit-publishError\">\n    <h2 class=\"j-message\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "publish_error", options) : helperMissing.call(depth0, "t", "publish_error", options)))
    + "</h2>\n    <p class=\"comment\"><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "try_again", options) : helperMissing.call(depth0, "t", "try_again", options)))
    + "</span></p>\n</footer>\n\n<footer class=\"popup-footer popup-footer-success j-videoEdit-success\">\n    <p class=\"comment\"><span class=\"j-message\"></span> ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "load_successfull", options) : helperMissing.call(depth0, "t", "load_successfull", options)))
    + "</p>\n    <h2><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "publish", options) : helperMissing.call(depth0, "t", "publish", options)))
    + "</span></h2>\n</footer>\n\n<footer class=\"popup-footer popup-footer-preloader j-videoEdit-preloader\">\n    <span class=\"preloader preloader-25\"></span>\n</footer>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/aside", function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<aside class=\"video-aside\">\n    <div class=\"banners j-banners-sticky\">\n        <div class=\"banner banner-appStore\">\n            <a href=\"/iphone\" rel=\"external\">\n                <span class=\"banner-appStore-text\">\n                    <span class=\"banner-appStore-text-1\">ПРИЛОЖЕНИЕ</span>\n                    <span class=\"banner-appStore-text-2\">Geometria</span>\n                    <span class=\"banner-appStore-text-3\">для iPhone</span>\n                    <span class=\"banner-appStore-text-4\">УЖЕ В APP STORE</span>\n                </span>\n                <span class=\"banner-appStore-phone\"></span>\n            </a>\n        </div>\n        <div class=\"banner banner-review\">\n            <span class=\"banner-review-title\">\n                Вам нравится новая Geometria&nbsp;TV?\n            </span>\n            <span class=\"banner-review-text\">\n                Мы делаем совершенно новую Геометрию. Видео-раздел — первый этап обновления всего сайта.\n            </span>\n            <span class=\"banner-review-share\">\n                <span class=\"banner-review-share-heading\">Рассказать друзьям:</span>\n                <span class=\"share\">\n                    <a class=\"share-item\" href=\"http://vkontakte.ru/share.php?url=http%3A%2F%2Fgeometria.ru%2Fspb%2Ftv%3Futm_source=vk.com&utm_medium=share&utm_campaign=smm&utm_content=Video&format=json\" data-type=\"vk\" data-target=\"Geometria_TV\" data-rawurl=\"http%3A%2F%2Fgeometria.ru%2Fspb%2Ftv\" rel=\"nofollow\">\n                        <i class=\"ico ico-share ico-share-vk\"></i>\n                    </a>\n                    <a class=\"share-item\" href=\"http://www.facebook.com/sharer.php?u=http%3A%2F%2Fgeometria.ru%2Fspb%2Ftv%3Futm_source=facebook.com&utm_medium=share&utm_campaign=smm&utm_content=Video&format=json\" data-type=\"facebook\" data-target=\"Geometria_TV\" data-rawurl=\"http%3A%2F%2Fgeometria.ru%2Fspb%2Ftv\" rel=\"nofollow\">\n                        <i class=\"ico ico-share ico-share-fb\"></i>\n                    </a>\n                    <a class=\"share-item\" href=\"http://twitter.com/share?url=http%3A%2F%2Fgeometria.ru%2Fspb%2Ftv%3Futm_source=twitter.com&utm_medium=share&utm_campaign=smm&utm_content=Video\" data-type=\"twitter\" data-target=\"Geometria_TV\" data-rawurl=\"http%3A%2F%2Fgeometria.ru%2Fspb%2Ftv\" rel=\"nofollow\">\n                        <i class=\"ico ico-share ico-share-tw\"></i>\n                    </a>\n                    <a class=\"share-item\" href=\"http://www.odnoklassniki.ru/dk?st.cmd=addShare&st._surl=http%3A%2F%2Fgeometria.ru%2Fspb%2Ftv%3Futm_source=odnoklassniki.ru&utm_medium=share&utm_campaign=smm&utm_content=Video\" data-type=\"odnoklassniki\" data-target=\"Geometria_TV\" data-rawurl=\"http%3A%2F%2Fgeometria.ru%2Fspb%2Ftv\" rel=\"nofollow\">\n                        <i class=\"ico ico-share ico-share-odkl\"></i>\n                    </a>\n                </span>\n            </span>\n            <span class=\"banner-review-button\">\n                Оставить отзыв\n            </span>\n        </div>\n    </div>\n</aside>";
  }};});
define("modules/tv/templates/compiled/tv/featured", ["lib/style!modules/video/styles/compiled/main", require, "lib/style!modules/tv/styles/compiled/tv/main", require, "lib/locale!modules/video/locales/compiled/", require, "lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, functionType="function", self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n        <div class=\"video-gallery\">\n            <div class=\"j-scrollFeatured\">\n                <div class=\"j-scrollFeaturedBox\">\n                    <div class=\"video-gallery-list\">\n                        ";
  stack1 = helpers.each.call(depth0, depth0.videos, {hash:{},inverse:self.noop,fn:self.program(2, program2, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n                    </div>\n                </div>\n            </div>\n\n            <div class=\"wrapper\">\n                <div class=\"video-gallery-prev j-video-gallery-prev\">\n                    <div class=\"video-gallery-prev-button\"></div>\n                </div>\n                <div class=\"video-gallery-next j-video-gallery-next\">\n                    <div class=\"video-gallery-next-button\"></div>\n                </div>\n                <div class=\"video-gallery-antifocus\"><!-- чтобы при двойном щелчке на Next не выделялся слайдер--></div>\n            </div>\n        </div>\n    ";
  return buffer;
  }
function program2(depth0,data) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n                        <div class=\"video-gallery-item j-video-gallery-item\">\n                            <div class=\"wrapper\">\n                                <div class=\"wrapper-in\">\n                                    <div class=\"videoPage-iframe\">\n                                        <div class=\"videoPage-startPanel j-player-startPanel ";
  stack1 = helpers['if'].call(depth0, depth0.withBanner, {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n                                            <img src=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.file),stack1 == null || stack1 === false ? stack1 : stack1.cover)),stack1 == null || stack1 === false ? stack1 : stack1.large)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" class=\"j-player-startPanel-background videoPage-startPanel-background\" alt=\"\">\n                                            ";
  stack2 = helpers['if'].call(depth0, depth0.isRecommended, {hash:{},inverse:self.noop,fn:self.program(5, program5, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                                            <div class=\"videoPage-startPanel-info\">\n                                                <div class=\"videoPage-startPanel-info-title\">";
  if (stack2 = helpers.title) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.title; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "</div>\n                                                <div class=\"videoPage-startPanel-info-bottom\">\n                                                    <span class=\"videoPage-startPanel-info-elem\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.date || depth0.date),stack1 ? stack1.call(depth0, depth0.date, options) : helperMissing.call(depth0, "date", depth0.date, options)))
    + "</span>\n                                                    ";
  stack2 = helpers['if'].call(depth0, ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place), {hash:{},inverse:self.noop,fn:self.program(7, program7, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                                                </div>\n                                            </div>\n                                            ";
  stack2 = helpers['if'].call(depth0, depth0.withBanner, {hash:{},inverse:self.noop,fn:self.program(9, program9, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                                            <div class=\"videoPage-startPanel-start\" data-id=\"";
  if (stack2 = helpers.id) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.id; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "\">\n                                                <div class=\"videoPage-startPanel-play\">\n                                                    <i class=\"videoPage-play-ico\"></i>\n                                                </div>\n                                            </div>\n                                        </div>\n                                        <div class=\"videoPage-iframeWrapper j-videoPage-iframeWrapper\">\n                                            <img src=\"/img/fake-iframe.gif\" class=\"videoPage-iframeWrapper-img\">\n                                        </div>\n                                    </div>\n\n                                </div>\n                            </div>\n                        </div>\n                        ";
  return buffer;
  }
function program3(depth0,data) {
  
  
  return "banner";
  }

function program5(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n                                                <div class=\"videoPage-startPanel-recommended\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "recommended", options) : helperMissing.call(depth0, "t", "recommended", options)))
    + "</div>\n                                            ";
  return buffer;
  }

function program7(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                                                        <a href=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place)),stack1 == null || stack1 === false ? stack1 : stack1.url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" rel=\"external\" class=\"videoPage-startPanel-info-elem videoPage-startPanel-info-place\">"
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place)),stack1 == null || stack1 === false ? stack1 : stack1.title)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</a>\n                                                    ";
  return buffer;
  }

function program9(depth0,data) {
  
  
  return "\n                                                <div class=\"videoPage-bannerWrapper\">\n                                                    <img class=\"videoPage-banner\" src=\"http://files2.geometria.ru/pics/original/27698706.jpg\">\n                                                </div>\n                                            ";
  }

function program11(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n        <div class=\"video-gallery\">\n            <div class=\"j-scrollFeatured\">\n                <div class=\"j-scrollFeaturedBox\">\n                    <div class=\"video-gallery-list\">\n                        <div class=\"video-gallery-item\">\n\n                            <div class=\"wrapper\">\n                                <div class=\"wrapper-in\">\n                                    <div class=\"videoPage-iframe\">\n                                        <div class=\"videoPage-startPanel j-player-startPanel ";
  stack1 = helpers['if'].call(depth0, depth0.withBanner, {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n                                            <div class=\"videoPage-startPanel-start\" data-id=\"";
  if (stack1 = helpers.id) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">\n                                                <div class=\"videoPage-startPanel-play\">\n                                                    <span class=\"preloader preloader-104\"></span>\n                                                </div>\n                                            </div>\n                                        </div>\n                                    </div>\n                                </div>\n                            </div>\n\n                        </div>\n                    </div>\n                </div>\n            </div>\n        </div>\n    ";
  return buffer;
  }

  buffer += "\n\n<section class=\"video-featured\">\n    ";
  stack1 = helpers['if'].call(depth0, depth0.isFetched, {hash:{},inverse:self.program(11, program11, data),fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n</section>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/list/categories/categories", function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "category", depth0, options) : helperMissing.call(depth0, "region", "category", depth0, options)))
    + "\n";
  return buffer;
  }

  stack1 = helpers.each.call(depth0, depth0.categories, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/list/categories/category", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, functionType="function", self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n            <a href=\"";
  if (stack1 = helpers.seeAllUrl) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.seeAllUrl; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\" class=\"video-block-seeAll\">\n                <span class=\"text\">";
  stack1 = helpers['if'].call(depth0, depth0.seeAllCount, {hash:{},inverse:self.program(4, program4, data),fn:self.program(2, program2, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</span>\n                <span class=\"arrow-right\"></span>\n            </a>\n        ";
  return buffer;
  }
function program2(depth0,data) {
  
  var stack1, options;
  options = {hash:{
    'count': (depth0.seeAllCount)
  },data:data};
  return escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "see_all_count", options) : helperMissing.call(depth0, "t", "see_all_count", options)));
  }

function program4(depth0,data) {
  
  var stack1, options;
  options = {hash:{},data:data};
  return escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "see_all", options) : helperMissing.call(depth0, "t", "see_all", options)));
  }

function program6(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n        <div class=\"j-scroll video-block-scroll\">\n            <div class=\"j-scrollBox video-block-scrollBox\">\n                <div class=\"j-scrollBox-inner video-block-scrollBox-inner\">\n                    ";
  stack1 = helpers.each.call(depth0, depth0.videoRows, {hash:{},inverse:self.noop,fn:self.programWithDepth(7, program7, data, depth0),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n                </div>\n            </div>\n            <div class=\"j-scrollBar video-block-scrollBar\">\n                <div class=\"j-scrollBar-runner handle video-block-scrollBar-runner\"></div>\n            </div>\n        </div>\n    ";
  return buffer;
  }
function program7(depth0,data,depth1) {
  
  var buffer = "", stack1;
  buffer += "\n                        <div class=\"video-items\">\n                            ";
  stack1 = (typeof depth0 === functionType ? depth0.apply(depth0) : depth0);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n                            ";
  stack1 = helpers['if'].call(depth0, depth1.showLastElement, {hash:{},inverse:self.noop,fn:self.programWithDepth(8, program8, data, depth1),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n                    </div>\n                    ";
  return buffer;
  }
function program8(depth0,data,depth2) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n                                ";
  options = {hash:{},inverse:self.noop,fn:self.programWithDepth(9, program9, data, depth2),data:data};
  stack2 = ((stack1 = helpers.eq || depth2.eq),stack1 ? stack1.call(depth0, depth2.lastRowIndex, ((stack1 = data),stack1 == null || stack1 === false ? stack1 : stack1.index), options) : helperMissing.call(depth0, "eq", depth2.lastRowIndex, ((stack1 = data),stack1 == null || stack1 === false ? stack1 : stack1.index), options));
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                            ";
  return buffer;
  }
function program9(depth0,data,depth3) {
  
  var buffer = "", stack1, stack2;
  buffer += "\n                                    <a href=\""
    + escapeExpression(((stack1 = depth3.seeAllUrl),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" class=\"video-item video-item-showAll\">\n                                        ";
  stack2 = helpers['if'].call(depth0, depth3.seeAllCount, {hash:{},inverse:self.program(12, program12, data),fn:self.programWithDepth(10, program10, data, depth3),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                                    </a>\n                                ";
  return buffer;
  }
function program10(depth0,data,depth4) {
  
  var buffer = "", stack1, options;
  buffer += "\n                                            <span class=\"video-item-showAll-count\">"
    + escapeExpression(((stack1 = depth4.seeAllCount),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</span>\n                                            <span class=\"video-item-showAll-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth4['t']),stack1 ? stack1.call(depth0, "see_all_video", options) : helperMissing.call(depth0, "t", "see_all_video", options)))
    + "&nbsp;<span class=\"arrow-right-white\"></span></span>\n                                        ";
  return buffer;
  }

function program12(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n                                            <span class=\"video-item-showAll-text video-item-showAll-text-center\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "see_all", options) : helperMissing.call(depth0, "t", "see_all", options)))
    + "&nbsp;<span class=\"arrow-right-white\"></span></span>\n                                        ";
  return buffer;
  }

function program14(depth0,data) {
  
  
  return "\n        <div class=\"preloader preloader-40 preloader-centered\"></div>\n    ";
  }

  buffer += "\n\n<section class=\"video-block\">\n\n    <header class=\"video-block-header cleared\">\n        <div class=\"heading-h2\">";
  if (stack1 = helpers.title) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.title; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</div>\n        ";
  stack1 = helpers['if'].call(depth0, depth0.showLastElement, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </header>\n\n    ";
  stack1 = helpers['if'].call(depth0, depth0.isFetched, {hash:{},inverse:self.program(14, program14, data),fn:self.program(6, program6, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n\n</section>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/list/search-results/list/all-in-category", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n            ";
  stack1 = helpers['if'].call(depth0, depth0.count, {hash:{},inverse:self.program(4, program4, data),fn:self.program(2, program2, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n        ";
  return buffer;
  }
function program2(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n                <span class=\"heading-h2-text\">";
  options = {hash:{
    'count': (depth0.count)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "found_all_video_from_category", options) : helperMissing.call(depth0, "t", "found_all_video_from_category", options)))
    + "</span>\n            ";
  return buffer;
  }

function program4(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n                <span class=\"heading-h2-text heading-h2-inactive\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "not_found_all_video_from_category", options) : helperMissing.call(depth0, "t", "not_found_all_video_from_category", options)))
    + "</span>\n            ";
  return buffer;
  }

function program6(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n            <span class=\"heading-h2-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "searching_all_video_from_category", options) : helperMissing.call(depth0, "t", "searching_all_video_from_category", options)))
    + "</span>\n            <span class=\"preloader preloader-25\"></span>\n        ";
  return buffer;
  }

  buffer += "\n\n<div class=\"video-items video-items-list\">\n    <div class=\"heading-h2\">\n        ";
  stack1 = helpers['if'].call(depth0, depth0.isFetched, {hash:{},inverse:self.program(6, program6, data),fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </div>\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "list", options) : helperMissing.call(depth0, "region", "list", options)))
    + "\n</div>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/list/search-results/list/all", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  
  return "heading-h2-inactive";
  }

function program3(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n            ";
  options = {hash:{
    'count': (depth0.count)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "found_video", options) : helperMissing.call(depth0, "t", "found_video", options)))
    + "\n        ";
  return buffer;
  }

function program5(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n            ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "not_found_video", options) : helperMissing.call(depth0, "t", "not_found_video", options)))
    + "\n        ";
  return buffer;
  }

  buffer += "\n\n<div class=\"video-items video-items-list\">\n    <div class=\"heading-h2 ";
  stack1 = helpers.unless.call(depth0, depth0.count, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n        ";
  stack1 = helpers['if'].call(depth0, depth0.count, {hash:{},inverse:self.program(5, program5, data),fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </div>\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "list", options) : helperMissing.call(depth0, "region", "list", options)))
    + "\n</div>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/list/search-results/list/category", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  
  return "heading-h2-inactive";
  }

function program3(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n            ";
  options = {hash:{
    'count': (depth0.count),
    'category': (depth0.categoryName)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "found_category_video_from_category", options) : helperMissing.call(depth0, "t", "found_category_video_from_category", options)))
    + "\n        ";
  return buffer;
  }

function program5(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n            ";
  options = {hash:{
    'category': (depth0.categoryName)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "not_found_category_video_from_category", options) : helperMissing.call(depth0, "t", "not_found_category_video_from_category", options)))
    + "\n        ";
  return buffer;
  }

  buffer += "\n\n<div class=\"video-items video-items-list\">\n    <div class=\"heading-h2 ";
  stack1 = helpers.unless.call(depth0, depth0.count, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n        ";
  stack1 = helpers['if'].call(depth0, depth0.count, {hash:{},inverse:self.program(5, program5, data),fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </div>\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "list", options) : helperMissing.call(depth0, "region", "list", options)))
    + "\n</div>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/list/search-results/results", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, functionType="function", escapeExpression=this.escapeExpression, helperMissing=helpers.helperMissing;


  buffer += "\n\n<a class=\"video-content-backButton\" href=\"";
  if (stack1 = helpers.backUrl) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.backUrl; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">\n    <span class=\"video-content-backButton-arrow\"></span>\n    <span class=\"video-content-backButton-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "back_to_video_list", options) : helperMissing.call(depth0, "t", "back_to_video_list", options)))
    + "</span>\n</a>\n\n";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "categoryResults", options) : helperMissing.call(depth0, "region", "categoryResults", options)))
    + "\n\n";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "allResults", options) : helperMissing.call(depth0, "region", "allResults", options)));
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/main", ["lib/style!modules/tv/styles/compiled/tv/main", "lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n\n<div class=\"video-header\">\n    <div class=\"wrapper\">\n        <div class=\"wrapper-in\">\n            <h1 class=\"heading-video\">\n                ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "tv_title", options) : helperMissing.call(depth0, "t", "tv_title", options)))
    + "\n                <small>";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "beta_title", options) : helperMissing.call(depth0, "t", "beta_title", options)))
    + "</small>\n            </h1>\n            ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "uploadButton", options) : helperMissing.call(depth0, "region", "uploadButton", options)))
    + "\n        </div>\n    </div>\n</div>\n\n";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "featured", options) : helperMissing.call(depth0, "region", "featured", options)))
    + "\n\n<section class=\"video-main\">\n\n<div class=\"wrapper\">\n    <div class=\"wrapper-in\">\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "navigation", options) : helperMissing.call(depth0, "region", "navigation", options)))
    + "\n        <div class=\"video-content-wrapper\">\n            <div class=\"video-content\">\n                <div class=\"video-blocks cleared\">\n                    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "list", options) : helperMissing.call(depth0, "region", "list", options)))
    + "\n                </div>\n            </div>\n            ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "aside", options) : helperMissing.call(depth0, "region", "aside", options)))
    + "\n        </div>\n    </div>\n</div>\n\n</section>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/navigation/navigation", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, stack2, options, self=this, helperMissing=helpers.helperMissing, functionType="function", escapeExpression=this.escapeExpression;

function program1(depth0,data) {
  
  
  return "expanded";
  }

function program3(depth0,data) {
  
  
  return "current";
  }

function program5(depth0,data,depth1) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n                <li class=\"";
  options = {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data};
  stack2 = ((stack1 = helpers.eq || depth0.eq),stack1 ? stack1.call(depth0, depth0.id, ((stack1 = depth1.currentCategory),stack1 == null || stack1 === false ? stack1 : stack1.id), options) : helperMissing.call(depth0, "eq", depth0.id, ((stack1 = depth1.currentCategory),stack1 == null || stack1 === false ? stack1 : stack1.id), options));
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += " videoMenu-item j-videoMenu-item j-videoMenu-item";
  if (stack2 = helpers.id) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.id; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "\">\n                    <a href=\"/"
    + escapeExpression(((stack1 = ((stack1 = depth1.city),stack1 == null || stack1 === false ? stack1 : stack1.urlName)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "/tv/";
  if (stack2 = helpers.urlName) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.urlName; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "/\" class=\"videoMenu-link\">";
  if (stack2 = helpers.name) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.name; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "</a>\n                    ";
  stack2 = helpers['if'].call(depth0, depth0.tags, {hash:{},inverse:self.noop,fn:self.programWithDepth(6, program6, data, depth1),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                </li>\n            ";
  return buffer;
  }
function program6(depth0,data,depth2) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n                        <ul class=\"videoMenu-subList\">\n                            <li class=\"";
  stack1 = helpers.unless.call(depth0, depth2.currentTag, {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += " videoMenu-subItem j-videoMenu-subItem\"><a href=\"/"
    + escapeExpression(((stack1 = ((stack1 = depth2.city),stack1 == null || stack1 === false ? stack1 : stack1.urlName)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "/tv/";
  if (stack2 = helpers.urlName) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.urlName; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "/\" class=\"videoMenu-subLink\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "navigation_all", options) : helperMissing.call(depth0, "t", "navigation_all", options)))
    + "</a></li>\n                            ";
  stack2 = helpers.each.call(depth0, depth0.tags, {hash:{},inverse:self.noop,fn:self.programWithDepth(7, program7, data, depth0, depth2),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                        </ul>\n                    ";
  return buffer;
  }
function program7(depth0,data,depth1,depth3) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n                                <li class=\"";
  options = {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data};
  stack2 = ((stack1 = helpers.eq || depth0.eq),stack1 ? stack1.call(depth0, depth0.id, ((stack1 = depth3.currentTag),stack1 == null || stack1 === false ? stack1 : stack1.id), options) : helperMissing.call(depth0, "eq", depth0.id, ((stack1 = depth3.currentTag),stack1 == null || stack1 === false ? stack1 : stack1.id), options));
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += " videoMenu-subItem j-videoMenu-subItem j-videoMenu-subItem";
  if (stack2 = helpers.id) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.id; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "\"><a href=\"/"
    + escapeExpression(((stack1 = ((stack1 = depth3.city),stack1 == null || stack1 === false ? stack1 : stack1.urlName)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "/tv/"
    + escapeExpression(((stack1 = depth1.urlName),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "/";
  if (stack2 = helpers.urlName) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.urlName; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "/\" class=\"videoMenu-subLink\">";
  if (stack2 = helpers.name) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.name; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "</a></li>\n                            ";
  return buffer;
  }

  buffer += "\n\n<header class=\"video-main-header ";
  stack1 = helpers['if'].call(depth0, depth0.currentCategory, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += " j-videoHeader\">\n\n    <nav class=\"videoMenu\">\n        <ul class=\"videoMenu-list\">\n            <li class=\"";
  stack1 = helpers.unless.call(depth0, depth0.currentCategory, {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += " videoMenu-item j-videoMenu-item\"><a href=\"/"
    + escapeExpression(((stack1 = ((stack1 = depth0.city),stack1 == null || stack1 === false ? stack1 : stack1.urlName)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "/tv/\" class=\"videoMenu-link\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "navigation_all", options) : helperMissing.call(depth0, "t", "navigation_all", options)))
    + "</a></li>\n            ";
  stack2 = helpers.each.call(depth0, depth0.categories, {hash:{},inverse:self.noop,fn:self.programWithDepth(5, program5, data, depth0),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n        </ul>\n    </nav>\n\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "searchInput", options) : helperMissing.call(depth0, "region", "searchInput", options)))
    + "\n\n</header>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/navigation/search-input", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, functionType="function", escapeExpression=this.escapeExpression, helperMissing=helpers.helperMissing;


  buffer += "\n<form class=\"search-form-content\">\n    <span class=\"search\">\n        <span class=\"search-control\">\n            <span class=\"search-control-inner\">\n                <span class=\"search-control-inner-icon\">\n                    <span class=\"search-control-inner-icon-loupe\"></span>\n                    <span class=\"preloader preloader-13\"></span>\n                </span>\n                <input type=\"text\" class=\"search-input\" autocomplete=\"off\" value=\"";
  if (stack1 = helpers.query) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.query; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "search_input_placeholder", options) : helperMissing.call(depth0, "t", "search_input_placeholder", options)))
    + "\"/>\n            </span>\n        </span>\n    </span>\n</form>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/tv/upload-button", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n<a href=\"#tv/upload\" class=\"upload-button btn\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "add_video", options) : helperMissing.call(depth0, "t", "add_video", options)))
    + "</a>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/upload/popup", ["lib/style!modules/tv/styles/compiled/tv/main", require, "lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n<article class=\"videoEdit\">\n    <section class=\"popup-body\">\n        <h2 class=\"popup-title\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "adding_video", options) : helperMissing.call(depth0, "t", "adding_video", options)))
    + "</h2>\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "videoForm", options) : helperMissing.call(depth0, "region", "videoForm", options)))
    + "\n    </section>\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "videoUpload", options) : helperMissing.call(depth0, "region", "videoUpload", options)))
    + "\n</article>";
  return buffer;
  }};});
define("modules/tv/templates/compiled/upload/video-upload", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n\n<input id=\"fileupload\" type=\"file\" name=\"file\" class=\"videoEdit-input j-videoEdit-input\">\n<footer class=\"popup-footer popup-footer-select j-videoEdit-select\">\n    <p class=\"comment j-message\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "file_characteristics", options) : helperMissing.call(depth0, "t", "file_characteristics", options)))
    + "</p>\n    <h2><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "select_file", options) : helperMissing.call(depth0, "t", "select_file", options)))
    + "</span></h2>\n</footer>\n\n<footer class=\"popup-footer popup-footer-progress j-videoEdit-progress\">\n    <div class=\"popup-footer-progressLine j-progressLine\"></div>\n    <div class=\"popup-footer-progressText j-progressText\">0%</div>\n    <div class=\"popup-footer-progressComment \">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loading", options) : helperMissing.call(depth0, "t", "loading", options)))
    + "<br/><span class=\"j-message\"></span></div>\n</footer>\n\n<footer class=\"popup-footer popup-footer-error j-videoEdit-error\">\n    <h2 class=\"j-message\"></h2>\n    <p class=\"comment\"><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "try_again", options) : helperMissing.call(depth0, "t", "try_again", options)))
    + "</span></p>\n</footer>\n\n<footer class=\"popup-footer popup-footer-error popup-footer-publishError j-videoEdit-publishError\">\n    <h2 class=\"j-message\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "publish_error", options) : helperMissing.call(depth0, "t", "publish_error", options)))
    + "</h2>\n    <p class=\"comment\"><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "try_again", options) : helperMissing.call(depth0, "t", "try_again", options)))
    + "</span></p>\n</footer>\n\n<footer class=\"popup-footer popup-footer-success j-videoEdit-success\">\n    <p class=\"comment\"><span class=\"j-message\"></span> ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "load_successfull", options) : helperMissing.call(depth0, "t", "load_successfull", options)))
    + "</p>\n    <h2><span class=\"pseudoLink j-link-text\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "publish", options) : helperMissing.call(depth0, "t", "publish", options)))
    + "</span></h2>\n</footer>\n\n<footer class=\"popup-footer popup-footer-preloader j-videoEdit-preloader\">\n    <span class=\"preloader preloader-25\"></span>\n</footer>";
  return buffer;
  }};});
define("modules/tv/views/edit/popup", [

    'underscore',
    'lib/view',
    'lib/template!modules/tv/templates/compiled/edit/popup',
    'modules/video/models/video',
    'modules/tv/views/edit/video-form',
    'modules/tv/views/edit/video-upload',
    'modules/common/views/flash-message',
    'lib/history/popup',
    'modules/common/views/popup',
    'lib/locale!modules/tv/locales/compiled/'

], function(_, View, popupTemplate, Video, VideoFormView, VideoUploadView, flashMessageView, popupHistory, popupView, locale) {
    'use strict';

    return View.extend({
        template: popupTemplate,

        regions: {
            videoForm: VideoFormView,
            videoUpload: VideoUploadView
        },

        initialize: function() {
            var uploadView = this._uploadView = this.getRegion('videoUpload').currentView;
            var formView = this._formView = this.getRegion('videoForm').currentView;
            this.listenTo(uploadView, 'uploaded', this._setFileId);
            this.listenTo(uploadView, 'submit', this._createVideo);
            this.listenTo(formView, 'save', this._saveVideo);
            this.listenTo(formView, 'fetchedRender', this._memorizeFormJSON);
            this.listenTo(popupView, 'beforeClose', _.bind(this._beforeClose, this));
        },

        _memorizeFormJSON: function() {
            this._formJSON = this._formView.serializeForm();
        },

        _setFileId: function(data) {
            this._formView.$('#f-fileId').val(data.id);
        },

        _createVideo: function() {
            this.model.set(this._formView.serializeForm());
            var result = this.model.save();

            if (result) {
                this._uploadView.setState('preloader');

                result.done(_.bind(function(xhr, status, data) {
                        popupHistory.navigate('video/' + this.model.get('id'), { trigger: true });
                        flashMessageView.success('modules/tv/locales/compiled/video_publish_success');

                    }, this)).fail(_.bind(function(xhr, status, data) {
                        this._uploadView.showPublishError();
                    }, this));
            }
        },

        _saveVideo: function() {
            this.model.set(this._formView.serializeForm());

            var result = this.model.save();

            if (result) {
                result
                    .done(_.bind(function(xhr, status, data) {
                        this._formView._needSave = false;
                        popupHistory.navigate('video/' + this.model.get('id'), { trigger: true });
                        flashMessageView.success('modules/tv/locales/compiled/video_change_success');
                    }, this))
                    .fail(_.bind(function() {
                        flashMessageView.error('modules/tv/locales/compiled/video_change_error');
                    }, this))
                    .always(_.bind(function() {
                        this._formView._onEndSave();
                    }, this));
            } else {
                this._formView._onEndSave();
            }
        },

        _beforeClose: function(eventData) {
            var actualFormJSON = this._formView.serializeForm();

            if (!_.isEqual(actualFormJSON,this._formJSON)) {
                if (!confirm(locale.get('confirm_video_close'))) {
                    eventData.abort();
                }
            }
        }
    });

});
define("modules/tv/views/edit/upload-view", [

    'underscore',
    'jquery',
    'jquery.file-uploader',
    'config',
    'lib/view',
    'lib/template!modules/tv/templates/compiled/edit/video-upload',
    'lib/locale!modules/tv/locales/compiled/'

], function(_, $, fileUploader, config, View, progressBarTemplate, locale) {
    'use strict';

    return View.extend({

        tagName: 'section',

        className: 'videoEdit-uploadBlock',

        template: progressBarTemplate,

        events: {
            'mouseenter': '_onMouseEnter',
            'mouseleave': '_onMouseLeave'
        },

        _state: null,

        _sid: null,

        afterRender: function() {
            this._$input = this.$('.j-videoEdit-input');
            this._progressLine = this.$('.j-progressLine')[0];
            this._$progressText = this.$('.j-progressText');

            $.getJSON('http://geometria.su/video/clip/get-upload-params?callback=?')
                .done(_.bind(this._uploadParamsProcessing, this));
        },

        _uploadParamsProcessing: function(data) {
            if (data.sid) {
                this._sid = data.sid;
            }
            this._initUploader();
        },

        /**
         *
         * @param state
         * @param options
         * @returns {boolean}
         */
        setState: function(state, options) {
            var $target = this.$('.j-videoEdit-' + state);
            var stateClassName = ' state-' + state;
            var rStatePattern = /state\-[a-z0-9\-_]+($|\s+)/gi;

            if ($target.length && !_.isUndefined(options)) {
                options.message && $target.find('.j-message').text(options.message);
                options.linkText && $target.find('.j-link-text').text(options.linkText);
            }

            this.el.className = this.el.className.replace(rStatePattern, "") + stateClassName;

            this._state = state;

            return false;
        },

        serialize: function() {
            return {};
        },

        _onMouseEnter: function() {
            this.$el.addClass('hover');
        },

        _onMouseLeave: function() {
            this.$el.removeClass('hover');
        },

        _onUploadSend: function(e, data) {
            this.setState('progress', { message: data.files[0].name });
        },

        _onUploadDone: function(e, data) {
            var result = data.result;
            if (result) {
                if (result.error) {
                    this._onUploadError(e, data);
                }
                if (result.success) {
                    this._onUploadSuccess(e, data);
                }
            }
        },

        _onUploadSuccess: function(e, data) {
            if (data.result && data.result.id) {
                this.trigger('uploaded', { id: data.result.id });
            }
        },

        _onUploadFail: function(e, data) {
            this.setState('error', {
                message: locale.get('network_error'),
                linkText: locale.get('try_again')
            });
        },

        _onUploadError: function(e, data) {
            var errorCode = data.result.error.code;
            var message, linkText;

            if (locale.has(errorCode + '_upload_error_message')) {
                message = locale.get(errorCode + '_upload_error_message');
            } else {
                message = locale.get('network_error');
            }
            if (locale.has(errorCode + '_upload_error_link_text')) {
                linkText = locale.get(errorCode + '_upload_error_link_text');
            } else {
                linkText = locale.get('try_again');
            }

            this.setState('error', {
                message: message,
                linkText: linkText
            });
        },

        _onUploadProgress: function(e, data) {
            var progress = parseInt(data.loaded / data.total * 100, 10) + '%';

            this._progressLine.style.width = progress;
            this._$progressText.text(progress);
        },

        _initUploader: function() { var isIframeUpload = !(window.XMLHttpRequestUpload && window.FileReader);
            var redirect = encodeURIComponent('http://' + document.domain + '/app/vendor/jquery.file-uploader/cors/result.html?%s'); // todo возможно поменять url
            var url = config.video.uploadUrl + '?sid=' + this._sid;
            var forceIframeTransport = false;

            this._$input.fileupload({
                    forceIframeTransport: forceIframeTransport,
                    redirect: redirect,
                    url: url,
                    dataType: 'json',
                    autoUpload: true,
                    paramName: 'file',
                    send: _.bind(this._onUploadSend, this),
                    done: _.bind(this._onUploadDone, this),
                    fail: _.bind(this._onUploadFail, this),
                    progress: _.bind(this._onUploadProgress, this)
                }
            );
        }
    });

});
define("modules/tv/views/edit/video-form", [

    'underscore',
    'selectize',
    'pikaday',
    'lib/selectize/plugins',
    'lib/form/view',
    'modules/video/collections/categories',
    'modules/common/collections/cities',
    'lib/template!modules/tv/templates/compiled/edit/video-form',
    'ui/form/views/checkbox',
    'lib/locale!modules/tv/locales/compiled/'

], function(_, Selectize, Pikaday, SelectizePlugins, FormView, Categories, Cities, videoFormTemplate, Checkbox, locale) {
    'use strict';

    return FormView.extend({

        _blockSave: false,

        _needSave: false,

        template: videoFormTemplate,

        regions: {
            checkbox: Checkbox
        },

        className: function() {
            return FormView.prototype.className + ' videoEdit-editBlock';
        },

        events: function() {
            return _.extend({}, FormView.prototype.events, {
                'click .j-link-with-report': '_showLinkWithReport',
                'click .j-link-with-report-clear': '_clearLinkWithReport',
                'click .j-save': '_save',
                'keypress .j-date-field': '_replaceNotDateCharacters'
            });
        },

        initialize: function() {
            var self = this;
            FormView.prototype.initialize.apply(this, arguments);

            this._categories = new Categories();

            this._cities = new Cities();

            var citiesFetchParams = { data: {
                limit: 299,
                onlyGeo: 1,
                sort: 'popularity desc'
            }};

            var categoriesDeferred = this._categories.fetch();
            var citiesDeferred = this._cities.fetch(citiesFetchParams);

            if (this.model.isNew()) {
                $.when(categoriesDeferred, citiesDeferred).done(function() {
                    self.render();
                });
            } else {
                $.when(categoriesDeferred, citiesDeferred, this.videoPromise).done(function() {
                    self.render();
                });
            }
        },

        afterRender: function() {
            FormView.prototype.afterRender.apply(this, arguments);
            if (this._categories.isFetched() && this._cities.isFetched()) {

                this._$selectCategory = this.$('.j-select-section');
                this._$selectTags = this.$('.j-select-category');

                this._$selectOriginCity = this.$('.j-select-originCity');
                this._$selectCities = this.$('.j-select-cities');

                this._$description = this.$('.j-description-field');

                this._$reportFieldSpan = this.$('.j-reportField');
                this._$reportField = this._$reportFieldSpan.find('#f-video-photoReportId');
                this._$linkWithReport = this.$('.j-link-with-report');
                this._$dateField = this.$('.j-date-field');
                this._$saveBtn = this.$('.j-save');

                this._$selectCategory.selectize({
                    plugins: ['geoSelect', 'tagsAsText'],
                    highlight: false,
                    hideSelected: false,
                    onChange: _.bind(this._selectCategory, this)
                });

                this._$selectTags.selectize({
                    plugins: ['geoSelect', 'tagsAsText'],
                    //sortField: 'name',
                    valueField: 'id',
                    labelField: 'name',
                    hideSelected: false,
                    highlight: false
                });

                this._$selectOriginCity.selectize({
                    plugins: ['geoSelect', 'tagsAsText'],
                    //sortField: 'name',
                    hideSelected: false,
                    highlight: false
                });

                this._$selectCities.selectize({
                    plugins: ['geoSelect', 'remove_button'], //TODO по возможности использовать родной плагин
                    //sortField: 'name',
                    hideSelected: true,
                    highlight: false
                });

                this.datePicker = new Pikaday({
                    field: this._$dateField[0],
                    format: 'DD.MM.YYYY',
                    firstDay: 1,
                    bound: false,
                    maxDate: new Date(),
                    i18n: {
                        previousMonth : locale.get('previous_month'),
                        nextMonth     : locale.get('next_month'),
                        months        : [locale.get('january'), locale.get('february'), locale.get('march'), locale.get('april'), locale.get('may'), locale.get('june'), locale.get('july'), locale.get('august'), locale.get('september'), locale.get('october'), locale.get('november'), locale.get('december')],
                        weekdays      : [locale.get('sunday'), locale.get('monday'), locale.get('tuesday'), locale.get('wednesday'), locale.get('thursday'), locale.get('friday'), locale.get('saturday')],
                        weekdaysShort : [locale.get('sun'), locale.get('mon'), locale.get('tue'), locale.get('wed'), locale.get('thu'), locale.get('fri'), locale.get('sat')]
                    }
                });

                this.datePicker.hide();

                this._$dateField.on('focus', _.bind(function() {
                    this.datePicker.show();
                },this));

                this._$dateField.on('blur', _.bind(function() {
                    this.datePicker.hide();
                },this));

                if (!this.model.isNew()) {

                    if (this._$description.val().length) {
                        this._$description.attr('disabled', 'disabled');
                    }

                    var categoryId = this._$selectCategory.data('value');
                    if (categoryId) {
                        this._$selectCategory[0].selectize.setValue(categoryId);
                    }

                    var tagsArray = this._$selectTags.data('value');
                    if (tagsArray) {
                        tagsArray = ('' + tagsArray).split(',');
                        this._$selectTags[0].selectize.setValue(tagsArray);
                    }

                    var originCityId = this._$selectOriginCity.data('value');
                    if (originCityId) {
                        this._$selectOriginCity[0].selectize.setValue(originCityId);
                    }

                    var cityesArray = this._$selectCities.data('value');
                    if (cityesArray) {
                        cityesArray = ('' + cityesArray).split(',');
                        this._$selectCities[0].selectize.setValue(cityesArray);
                    }
                }

                this.trigger('fetchedRender'); //todo возможно стоит придумать отдельное событие для рэндера с данными, а то неудобно везде делать такие проверки

            }
        },

        serialize: function() {
            var videoJSON = this.model.toJSON();

            if (videoJSON.tags) {
                videoJSON.tags = _.pluck(videoJSON.tags, 'id');
            }

            if (videoJSON.cities) {
                videoJSON.cities = _.pluck(videoJSON.cities, 'id');
            }

            return _.extend(videoJSON, {
                isFetched: this._categories.isFetched(),
                categories: this._categories.toJSON(),
                cityArray: this._cities.toJSON(),
                isNew: this.model.isNew(),
                isRecommendedCheckboxOptions: {
                    name: "isRecommended",
                    checked: !!videoJSON.isRecommended,
                    label: "modules/tv/locales/compiled/is_recommended"
                },
                isFeaturedCheckboxOptions: {
                    name: "isFeatured",
                    checked: !!videoJSON.isFeatured,
                    label: "modules/tv/locales/compiled/is_featured"
                }
            });
        },

        serializeForm: function() {
            var data = FormView.prototype.serializeForm.call(this);

            if (data.photoReport.id != parseInt(data.photoReport.id)) {
                var matches = data.photoReport.id.match(/\d+$/);

                if (matches !== null) {
                    data.photoReport.id = matches[0];
                }
            }

            return data;
        },

        beforeRemove: function() {
            FormView.prototype.beforeRemove.apply(this, arguments);
            this._$selectCategory[0].selectize.destroy();
            this._$selectTags[0].selectize.destroy();
            this.datePicker.destroy();
        },

        _selectCategory: function(id) {
            var currentCategory = this._categories.findWhere({ id : parseInt(id, 10) });
            var tagsSelect = this._$selectTags[0].selectize;

            tagsSelect.enable();
            tagsSelect.clearOptions();

            tagsSelect.addOption(currentCategory.get('tags').toJSON());
        },

        _showLinkWithReport: function(e) {
            e.stopPropagation();
            if (!this._$linkWithReport.hasClass('active')) {
                this._$linkWithReport.addClass('active');
                this._$reportFieldSpan.removeClass('hidden');
            }
        },
        
        _clearLinkWithReport: function(e) {
            e.stopPropagation();
            this._$reportFieldSpan.addClass('hidden');
            this._$reportField.val('');
            this._$linkWithReport.removeClass('active');
        },

        _replaceNotDateCharacters: function(e) {
            var value = $(e.currentTarget).val();

            if (value.length > 9
                || e.which != 46 && (e.which < 47 || e.which > 58)
                || (e.which == 46 && !(value.length == 2 || value.length == 5))
                || (e.which > 47 && e.which < 58 && (value.length == 2 || value.length == 5))
            ) {
                e.preventDefault();
            }
        },

        _onStartSave: function() {
            this._blockSave = true;
            this._$saveBtn.addClass('disabled');
            this.trigger('save');
        },

        _onEndSave: function() {
            this._blockSave = false;
            this._$saveBtn.removeClass('disabled');
        },

        _save: function() {
            if (this._blockSave === false) {
                this._onStartSave();
            }
            return false;
        }
    });

});
define("modules/tv/views/edit/video-upload", [

    'modules/tv/views/edit/upload-view'

], function(UploadView) {
    'use strict';

    var editMixin = function() {
        return {
            after: {
                initialize: function() {
                    this.setState('preloader');
                },

                _uploadParamsProcessing: function() {
                    this.setState('replace');
                },

                _onUploadSuccess: function(e, data) {
                    this.setState('replace');
                }
            }
        };
    };

    return UploadView.extend().mixin([ editMixin ]);

});
define("modules/tv/views/tv/aside", [

    'lib/vendor/jquery.hcsticky/jquery.hcsticky',
    'lib/view',
    'lib/template!modules/tv/templates/compiled/tv/aside'

], function(jQuerySticky, View, asideTemplate) {
    'use strict';

    return View.extend({
        title: 'aside',

        template: asideTemplate,

        events: {
            'click .banner-review-button': 'showUserVoice',
            'click .share-item': 'socialShare'
        },

        socialShare: function(event) {
            var url = $(event.currentTarget).attr('href');
            var width = 554;
            var height = 360;
            var params = [
                'scrollbars=0',
                'resizable=1',
                'menubar=0',
                'width=' + width,
                'height=' + height,
                'left=' + (screen.width - width) / 2,
                'top=' + (screen.height - height) / 2,
                'toolbar=0',
                'status=0'
            ];

            if (this.popup) {
                this.popup.close();
            }

            this.popup = window.open(url, '_blank', params.join(','));
            this.popup.focus();

            return false;
        },

        showUserVoice: function() {
            require(['lib/userVoice'], function(UserVoice) {
                UserVoice.show();
            });
        },

        initialize: function() {
            var self = this;
            this.on('appended', function() {
                self.$('.j-banners-sticky').hcSticky({
                    top: 35,
                    bottom: 35,
                    noContainer: true
                });
            });
        }
    });

});
define("modules/tv/views/tv/featured", [
    'underscore',
    'lib/view',
    'ui/video-player/views/video-player',
    'lib/template!modules/tv/templates/compiled/tv/featured',
    'modules/common/models/current-city'

], function(_, View, VideoPlayerView, featuredTemplate, currentCity) {
    'use strict';

    return View.extend({

        template: featuredTemplate,

        regions: {
            player: null
        },

        events: {
            'click .j-player-startPanel': '_playVideo'
        },

        _activeFrame: null,
        _sly: null,
        _startPanels: null,
        //_playedFrame: null,

        initialize: function() {
            var self = this;
            this.listenTo(this.collection, 'fetched', function () {
                this.render();
                this._loadImg();
            });

            var cityId = currentCity.get('id');
            var fieldsWithoutCategory = 'id,title,url,embedUrl,date,isFeatured,isRecommended,description,file(cover),photoReport(place(title,url))';//description,author
            var fieldsWithCategory = fieldsWithoutCategory + ',category';
            this.collection.fetch({ //todo: get featured video
                data: {
                    sort: 'popularity desc',
                    cityId: cityId,
                    _fields: fieldsWithCategory
                }
            });
        },

        _removePlayer: function() {
            if (this._player) {
                this._player.remove();
                //this._startPanel.show();
            }
            this._player = null;
            //this._startPanel = null;
            this._startPanels.show();
        },

        _playVideo: function(e) {

            var $video = $(e.target);
            var $videoContainer = $video.closest('.j-video-gallery-item');

            //this._playedFrame = $videoContainer

            if ($videoContainer.get(0) == this._activeFrame.get(0)) {

                var $iframeWraper = $videoContainer.find('.j-videoPage-iframeWrapper');
                var videoId = $video.data('id');

                var videos = this.collection.toJSON();

                var currentVideo = _.find(videos, function(video) {
                    if (video.id == videoId) {
                        return true;
                    }
                });

                if (!currentVideo) { //todo: решить проблему с отсутствием нужного видео в списке
                    currentVideo = videos[0];
                }

                this._removePlayer();

                var player = new VideoPlayerView( { url : currentVideo.embedUrl } );

                $iframeWraper.append(player.$el);

                this._player = player;
                //this._startPanel = $videoContainer.find('.j-player-startPanel');

                player.play();
                $(e.currentTarget).fadeOut(500);
            }
        },

        _loadImg: function() {
            var self = this;

            var $bg = this.$('.j-player-startPanel-background');

            this._$hiddenImg = $('<img class="videoPage-hiddenImg">');

            this._$hiddenImg.attr('src', $bg.attr('src')).appendTo('body');
            this._$hiddenImg.on('load', function() {
                $bg.fadeIn(300);
                self._$hiddenImg.remove();
            });
        },

        serialize: function() {
            return {
                videos: this.collection.toJSON(),
                isFetched: this.collection.isFetched()
            }
        },

        afterRender: function() {
            if (this.collection.isFetched()) {
                if (this.isAppended) {
                    this._initSlider();
                } else {
                    this.on('appended', _.bind(this._initSlider, this));
                }
            }
        },

        reload: function() {
            this.slyObject.reload();
        },

        _calculateSizes: function () {
//            console.log('resize')
//            var width = $(window).width()/1.5;
//            var height = $(window).height()*0.533/1.5;
//            $('.j-video-gallery-item').width(width).height(height);
//
//            this._sly.reload();
        },

        _initSlider: function() {

            var $scrollBox  = this.$('.j-scrollFeaturedBox');
            var $prevButton = this.$('.j-video-gallery-prev');
            var $nextButton = this.$('.j-video-gallery-next');
            this._startPanels = $scrollBox.find('.j-player-startPanel');



            var isOpera = false; //$('body').hasClass('htc-opera');

            var scrollByNormal = isOpera ? 100 : 200;
            var speedNormal = isOpera ? 100 : 200;
            var speedItems = isOpera ? 200 : 500;

            var $frames = $scrollBox.find('.j-video-gallery-item');

            $scrollBox.children().eq(0).append($()
                .add($frames.eq(0).clone())
                .add($frames.eq(1).clone())
                .add($frames.eq(2).clone())
                .add($frames.eq(3).clone())
            )

            var frame = window.frame = new Sly($scrollBox, {//todo remove
                //nativeScroll: isOpera,
                //itemSelector: '.j-video-gallery-item',
                itemNav: 'forceCentered',
                activateMiddle: 1,
                activateOn: 'click',
                horizontal: 1,
                smart: 1,
                startAt: 5,
                //scrollBy: 1,
                //scrollSource: $scrollBox,
                //dragSource: this.__$slyWrapperSelector,
                mouseDragging: true,
                touchDragging: true,
                dragHandle: true,
                dynamicHandle: 1,
                speed: speedNormal,
                //easing: 'easeOutExpo',
                releaseSwing: 0,
                elasticBounds: 1,
                clickBar: 1,

                // Buttons
                prev: $prevButton,
                next: $nextButton
            }, {
                active: _.bind(function () {

                    this._removePlayer();
                }, this),

                moveEnd: _.bind(function () {

                    var active = frame ? frame.rel.activeItem : 3;

                    this._activeFrame = $(frame.items[active].el);

                    if (frame) {
                        if (active <= 1) {

                            frame.activate($(frame.items[frame.items.length-3].el), true);

                        } else if (active >= frame.items.length-2){

                            frame.activate($(frame.items[2].el), true);
                        }
                    }
                }, this)
            }).init();

            this._sly = frame;

            this._calculateSizes();
            $(window).on('resize', _.bind(this._calculateSizes, this));
        }
    });

});
define("modules/tv/views/tv/list/categories/categories", [

    'underscore',
    'lib/view',
    'lib/template!modules/tv/templates/compiled/tv/list/categories/categories',
    'modules/tv/views/tv/list/categories/category',
    'lib/locale!modules/tv/locales/compiled/'

], function(_, View, categoriesTemplate, CategoryView, locale) {
    'use strict';

    return View.extend({
        template: categoriesTemplate,

        regions: {
            category: CategoryView
        },

        _fieldsWithoutCategory: 'id,title,date,file(cover),photoReport(place(title,url))',
        _fieldsWithCategory: null,

        initialize: function() {
            this._fieldsWithCategory = this._fieldsWithoutCategory + ',category';
        },

        serialize: function() {
            var cityId = this.options.city.get('id');
            var fieldsWithoutCategory = 'id,title,date,file(cover),photoReport(place(title,url))';
            var fieldsWithCategory = fieldsWithoutCategory + ',category';

            return {
                categories: [
                    {
                        title: locale.get('new_videos'),
                        seeAllUrl: this._getFullUrl('new'),
                        showCategory: true,
                        rows: 2,
                        fetchData: {
                            cityId: cityId,
                            _fields: fieldsWithCategory
                        }
                    },
                    {
                        title: locale.get('popular_videos'),
                        seeAllUrl: this._getFullUrl('popular'),
                        showCategory: true,
                        fetchData: {
                            sort: 'popularity desc',
                            cityId: cityId,
                            _fields: fieldsWithCategory
                        }
                    },
                    {
                        title: locale.get('albums_videos'),
                        seeAllUrl: this._getFullUrl('tag/reports'),
                        showCategory: true,
                        fetchData: {
                            sort: 'date desc',
                            tagId: 1,
                            cityId: cityId,
                            _fields: fieldsWithCategory
                        }
                    }
                ].concat(_.map([3, 1, 6, 2, 5, 4], this._getOptionsByCategoryId, this))
            };
        },

        _getFullUrl: function(fragment) {
            return '/' + this.options.city.get('urlName') + '/tv/' + fragment;
        },

        _getOptionsByCategoryId: function(categoryId) {
            var category = this.options.categories.get(categoryId);
            var cityId = this.options.city.get('id');

            return {
                title: category.get('name'),
                seeAllUrl: this._getFullUrl(category.get('urlName')),
                seeAllCount: true,
                fetchData: {
                    categoryId : categoryId,
                    cityId: cityId,
                    _fields: this._fieldsWithoutCategory
                }
            };
        }
    });

});
define("modules/tv/views/tv/list/categories/category", [

    'underscore',
    'sly',
    'lib/view',
    'modules/video/collections/videos',
    'lib/template!modules/tv/templates/compiled/tv/list/categories/category',
    'lib/template!modules/video/templates/compiled/list/_videos'

], function(_, Sly, View, Videos, categoryTemplate, videosPartial) {
    'use strict';

    return View.extend({
        template: categoryTemplate,

        _$scrollBox: null,

        initialize: function() {
            this.collection = new Videos();

            this.collection.fetch({
                data: this.options.fetchData
            });

            this.listenTo(this.collection, 'fetched', this.render);
        },

        render: function() {
            if (this.collection.totalCount > 0) {
                View.prototype.render.call(this);
            }

            return this;
        },

        afterRender: function() {
            var self = this;
            var $scroll = this.$('.j-scroll');

            if ($scroll.length) {
                this._$scrollBox = $scroll.find('.j-scrollBox');
                var $scrollBar = $scroll.find('.j-scrollBar');

                this._$scrollBox.sly({
                    horizontal: 1,
                    mouseDragging: 1,
                    touchDragging: 1,
                    dragHandle: 1,
                    clickBar: 1,
                    dynamicHandle: 1,
                    scrollBar: $scrollBar,
                    smart: 1,
                    releaseSwing: 1,
                    speed: 100,
                    elasticBounds: 1
                });

                $(window).resize(function() {
                    self._$scrollBox.sly('reload');
                });
            }
        },

        beforeRemove: function() {
            if (this._$scrollBox) {
                this._$scrollBox.sly(false);
            }
        },

        serialize: function() {
            var rowsCount = this.options.rows || 1;
            var videoArray = this.collection.toJSON();
            if (rowsCount === 2) {
                videoArray.length--;
            }

            var videoRows = _(videoArray).groupBy(function(value, index) {
                return index++ % rowsCount;
            }).map(function(videos) {
                return videosPartial.render({
                    videos: videos,
                    showCategory: this.options.showCategory
                });
            }, this).value();

            return {
                lastRowIndex: rowsCount - 1,
                isFetched: this.collection.isFetched(),
                title: this.options.title,
                seeAllUrl: this.options.seeAllUrl,
                seeAllCount: this.options.seeAllCount ? this.collection.totalCount : 0,
                showLastElement: this.collection.totalCount > this.collection.length,
                videoRows: videoRows
            };
        }
    });
});
define("modules/tv/views/tv/list/search-results/list", [

    'underscore',
    'lib/view',
    'ui/infinite-scroll/views/infinite-scroll',
    'lib/template!modules/video/templates/compiled/list/_videos'

], function(_, View, InfiniteScrollView, videosPartial) {
    'use strict';

    return View.extend({

        options: {
            serialize: {}
        },

        regions: {
            list: null
        },

        initialize: function() {
            this.listenTo(this.collection, 'fetched', this.render);
        },

        serialize: function() {
            return _.extend(this.options.serialize, {
                isFetched: this.collection.isFetched(),
                count: this.collection.totalCount
            });
        },

        afterRender: function() {
            if (!this.collection.isFetched()) {
                return;
            }

            var showCategory = this.options.showCategory;

            var infiniteScrollView = new InfiniteScrollView({
                template: videosPartial,
                collection: this.options.collection,
                fetch : {
                    data: this.options.fetchData
                },
                serialize: function(collection) {
                    return {
                        videos: collection.toArrangedJSON(this.offset > 0), // TODO: Fix dirty hack
                        showRecommended: false,
                        showCategory: showCategory
                    };
                }
            });

            this.getRegion('list').show(infiniteScrollView);
        }
    });
});
define("modules/tv/views/tv/list/search-results/results", [

    'lib/view',
    'modules/tv/views/tv/list/search-results/list',
    'lib/template!modules/tv/templates/compiled/tv/list/search-results/results',
    'lib/template!modules/tv/templates/compiled/tv/list/search-results/list/all',
    'lib/template!modules/tv/templates/compiled/tv/list/search-results/list/all-in-category',
    'lib/template!modules/tv/templates/compiled/tv/list/search-results/list/category'

], function(View, ResultsListView, ResultsTemplate, AllResultsTemplate, AllResultsInCategoryTemplate, CategoryResultsTemplate) {
    'use strict';

    return View.extend({
        template: ResultsTemplate,

        regions: {
            categoryResults: null,
            allResults: null
        },

        serialize: function() {
            return {
                backUrl: this.options.backUrl
            };
        },

        afterRender: function() {
            var resultsListView;

            // TODO: Refactor

            if (this.options.categoryResults) {
                resultsListView = new ResultsListView({
                    collection: this.options.categoryResults,
                    fetchData: this.options.categoryFetchData,
                    serialize: {
                        categoryName: this.options.category.get('name')
                    }
                });
                resultsListView.template = CategoryResultsTemplate;
                this.getRegion('categoryResults').show(resultsListView);

                if (this.options.allResults) {
                    resultsListView = new ResultsListView({
                        collection: this.options.allResults,
                        fetchData: this.options.allFetchData,
                        showCategory: true
                    });
                    resultsListView.template = AllResultsInCategoryTemplate;
                    this.getRegion('allResults').show(resultsListView);
                }
            } else if (this.options.allResults) {
                resultsListView = new ResultsListView({
                    collection: this.options.allResults,
                    fetchData: this.options.allFetchData,
                    showCategory: true
                });
                resultsListView.template = AllResultsTemplate;
                this.getRegion('allResults').show(resultsListView);
            }
        }
    });
});
define("modules/tv/views/tv/main", [

    'lib/view',
    'lib/template!modules/tv/templates/compiled/tv/main',
    'modules/tv/views/tv/aside'

], function(View, mainTemplate, AsideView) {
    'use strict';

    return View.extend({
        title: 'main',

        template: mainTemplate,

        regions: {
            uploadButton: null,
            featured: null,
            navigation: null,
            list: null,
            aside: null
        },

        initialize: function() {
            var self = this;
            this.on('appended', function() {
                self.getRegion('aside').show(new AsideView());
            });
        }
    });

});
define("modules/tv/views/tv/navigation/navigation", [

    'lib/view',
    'modules/tv/views/tv/navigation/search-input',
    'lib/template!modules/tv/templates/compiled/tv/navigation/navigation'

], function(View, SearchInputView, navigationTemplate) {
    'use strict';

    return View.extend({
        template: navigationTemplate,

        regions: {
            searchInput: SearchInputView
        },

        initialize: function() {
            this.listenTo(this.collection, 'fetching', this.render);
            this.listenTo(this.collection, 'fetched', this.render);
        },

        serialize: function() {
            var result = {
                categories: this.collection.toJSON(),
                city: this.options.city.toJSON()
            };

            if (this.options.category) {
                result.currentCategory = this.options.category.toJSON();
            }

            if (this.options.tag) {
                result.currentTag = this.options.tag.toJSON();
            }

            return result;
        },

        afterRender: function() {
            this.__$videoHeader = this.$('.j-videoHeader');
            this.__$items = this.__$videoHeader.find('.j-videoMenu-item');
            this.__$subItems = this.__$videoHeader.find('.j-videoMenu-subItem');
            this.__$currentItem = this.__$items.filter('.current');
            this.__$currentSubItem = this.__$subItems.filter('.current');
        },

        changeCurrent: function(category, tag) {
            var categoryId;
            var tagId;

            if (category) {
                categoryId = category.get('id');
                this.__$videoHeader.addClass('expanded');
                this.__$currentItem.removeClass('current');
                this.__$currentItem = this.__$items.filter('.j-videoMenu-item' + categoryId);
                this.__$currentItem.addClass('current');
                if (tag) {
                    tagId = tag.get('id');
                    this.__$currentSubItem.removeClass('current');
                    this.__$currentSubItem = this.__$subItems.filter('.j-videoMenu-subItem' + tagId);
                    this.__$currentSubItem.addClass('current');
                } else {
                    this.__$currentSubItem.removeClass('current');
                    this.__$currentSubItem = this.__$subItems.filter(':visible').first();
                    this.__$currentSubItem.addClass('current');
                }
            } else {
                this.__$videoHeader.removeClass('expanded');
                this.__$currentItem.removeClass('current');
                this.__$currentSubItem.removeClass('current');
                this.__$currentItem = this.__$items.first();
                this.__$currentItem.addClass('current');
            }
        }
    });

});
define("modules/tv/views/tv/navigation/search-input", [

    'jquery',
    'underscore',
    'lib/view',
    'lib/template!modules/tv/templates/compiled/tv/navigation/search-input'

], function($, _, View, searchTemplate) {
    'use strict';

    return View.extend({
        template: searchTemplate,

        events: {
            'submit form': '_submitHandler',
            'keyup .search-input': '_inputHandler'
        },

        _inputTimeout: null,

        serialize: function() {
            return {
                query: this.options.search
            };
        },

        showLoading: function() {
            this.$el.addClass('loading');
        },

        hideLoading: function() {
            this.$el.removeClass('loading');
        },

        clearInput: function() {
            this.$('.search-input').val('');
        },

        _inputHandler: function(e) {
            var $target = $(e.target);
            var query = $target.val();

            if (this._inputTimeout) {
                clearTimeout(this._inputTimeout);
            }

            if (e.which === 13) {
                this.trigger('input', query);
            } else {
                var timeoutHandler = _.bind(this.trigger, this, 'input', query);

                this._inputTimeout = setTimeout(timeoutHandler, 500);
            }
        },

        _submitHandler: function(e) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

});
define("modules/tv/views/tv/upload-button", [

    'lib/view',
    'lib/template!modules/tv/templates/compiled/tv/upload-button'

], function(View, uploadButtonTemplate) {
    'use strict';

    return View.extend({
        template: uploadButtonTemplate
    });

});
define("modules/tv/views/upload/popup", [

    'underscore',
    'lib/view',
    'lib/template!modules/tv/templates/compiled/upload/popup',
    'modules/video/models/video',
    'modules/tv/views/edit/video-form',
    'modules/tv/views/upload/video-upload',
    'modules/common/views/flash-message',
    'lib/history/popup',
    'lib/locale!modules/tv/locales/compiled/'

], function(_, View, popupTemplate, Video, VideoFormView, VideoUploadView, flashMessageView, popupHistory, locale) {
    'use strict';

    return View.extend({
        template: popupTemplate,

        regions: {
            videoForm: VideoFormView,
            videoUpload: VideoUploadView
        },

        initialize: function() {
            var uploadView = this._uploadView = this.getRegion('videoUpload').currentView;
            this._formView = this.getRegion('videoForm').currentView;
            this.listenTo(uploadView, 'uploaded', this._setFileId);
            this.listenTo(uploadView, 'submit', this._createVideo);
        },


        _setFileId: function(data) {
            this._formView.$('#f-fileId').val(data.id);
        },

        _createVideo: function() {
            this.model.set(this._formView.serializeForm());

            var result = this.model.save();

            if (result) {
                this._uploadView.setState('preloader');

                result.done(_.bind(function(success, statusText, jqXHR ) {
                        popupHistory.navigate('video/' + success.data.item.id, { trigger: true });
                        flashMessageView.success('modules/tv/locales/compiled/video_publish_success');

                    }, this)).fail(_.bind(function(xhr, status, data) {
                        this._uploadView.showPublishError();
                    }, this));
            }
        }
    });

});
define("modules/tv/views/upload/video-upload", [

    'modules/tv/views/edit/upload-view',
    'lib/locale!modules/tv/locales/compiled/'

], function(UploadView, locale) {
    'use strict';

    var uploadMixin = function() {
        return {
            addToObj: {
                events: {
                    'click .j-videoEdit-success, .j-videoEdit-publishError': '_publish'
                }
            },
            after: {

                _uploadParamsProcessing: function() {
                    this.setState('select');
                },

                _publish: function() {
                    this.trigger('submit');
                },

                showPublishError: function() {
                    this.setState('publishError', {
                        message: locale.get('publish_error'),
                        linkText: locale.get('try_again')
                    });
                },

                _onUploadSuccess: function(e, data) {
                    this.setState('success', { message: data.files[0].name});
                }
            }
        };
    };

    return UploadView.extend().mixin([ uploadMixin ]);


});

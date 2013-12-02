define("modules/video/collections/categories", [

    'lib/collection',
    'modules/video/models/category'

], function(Collection, Category) {
    "use strict";

    return Collection.extend({
        url: '/v1/video/categories/',

        model: Category
    });

});
define("modules/video/collections/tags", [

    'lib/collection',
    'modules/video/models/tag'

], function(Collection, Tag) {
    "use strict";

    return Collection.extend({
        model: Tag
    });

});
define("modules/video/collections/videos", [

    'backbone',
    'underscore',
    'lib/collection',
    'modules/video/models/video'

], function(Backbone, _, Collection, Video) {
    "use strict";

    return Collection.extend({
        url: '/v1/video/',

        model: Video,

        toArrangedJSON: (function() {
            var count = 0;

            return function(isAppend) {
                if (!isAppend) {
                    count = 0;
                }

                var videos = this.toJSON();
                var bigElements = [];
                var newElements = [];

                // Проставляем крайним правым элементам класс isRight и переформируем коллекцию, чтобы не было пустого места из-за рекомендованных
                _.each(videos, function(element) {
                    count++;
                    if (element.isRecommended) {
                        count++;
                    }

                    // Если строка пока ещё пустая и у нас есть рекомендованные элементы на очереди - добавляем обычный элемент и рекомендованный в строку
                    if (count === 1 && bigElements.length !== 0) {
                        newElements.push(bigElements.shift());
                        element.isRight = true;
                        newElements.push(element);
                        count = 0;
                        return;
                    }

                    // Если строка сформировалась - ставим isRight
                    if (count === 3) {
                        count = 0;
                        element.isRight = true;
                    }

                    // Если элемент рекомендованный, а в строке уже есть два элемента - сохраняем рекомендованный в очередь
                    if (count === 4) {
                        count = count - 2;
                        bigElements.push(element);
                    } else { // Иначе просто добавляем элемент в новый массив
                        newElements.push(element);
                    }
                }, this);

                //Устанавливаем правильный count после вставки рекомендованных из очереди
                if (bigElements.length === 1 && count === 1) {
                    count = 0;
                } else if (bigElements.length !== 0) {
                    count = 2;
                }

                //Добавляем оставшиеся рекомендованные в конец массива
                return newElements.concat(bigElements);
            };
        }())
    });
});
define("modules/video/controllers/video", [

    'underscore',
    'app',
    'lib/controller',
    'modules/video/views/video/video',
    'modules/video/views/video/related',
    'modules/common/views/popup',
    'modules/video/models/video',


], function(_, app, Controller, VideoView, RelatedView, popupView, Video) {
    'use strict';

    return Controller.extend({

        index: function(params) {
            var video = new Video({ id: params.id });

            var videoView = new VideoView({ nested: { model: video }});

            video.fetch({
                data: {
                    _fields: 'id,title,url,embedUrl,date,isFeatured,isRecommended,category,file(cover),photoReport(place(title,url))'
                }
            });

            /*var relatedView = new RelatedView();

            video.fetch().done(function() {
                relatedView.collection = video.get('relatedVideo');
                relatedView.$el.appendTo(videoView.$el);
                relatedView.render();
            });

            videoView.on('remove', function() {
                relatedView.remove();
            });
             */

            popupView.open(videoView, 'videoPopup');

        }
    });
});
define("modules/video/locales/compiled/ru", {"published": "Опубликовано", "author": "Автор", "recommended": "Геометрия рекомендует", "from_category": "Другие видео раздела", "video_delete_success": "Видео успешно удалено", "video_delete_error": "При удалении видео произошла ошибка"});
define("modules/video/models/category", [

    'backbone',
    'lib/model',
    'modules/video/collections/tags',
    'modules/video/models/tag'


], function(Backbone, Model, Tags, Tag) {

    return Model.extend({
        defaults: {
            name: null
        },
        relations: [
            {
                type: Backbone.Many,
                key: 'tags',
                relatedModel: Tag,
                collectionType: Tags
            }
        ]
    });

});
define("modules/video/models/file", [

    'backbone',
    'lib/model',
    'lib/collection',
    'modules/common/models/photo-report',
    'modules/video/models/category',
    'modules/video/models/tag',
    'modules/video/collections/tags'

], function(Backbone, Model) {
    "use strict";

    var File = Model.extend({
        defaults: {
            files: null,
            cover: null
        }
    });

    return File;
});
define("modules/video/models/tag", [

    'lib/model'

], function(Model) {

    return Model.extend({
        defaults: {
            name: null
        }
    });

});
define("modules/video/models/video", [

    'backbone',
    'underscore',
    'lib/model',
    'lib/collection',
    'modules/common/models/photo-report',
    'modules/video/models/category',
    'modules/video/models/tag',
    'modules/video/collections/tags',
    'modules/video/models/file',
    'modules/common/models/city',
    'modules/common/collections/cities'

], function(Backbone, _, Model, Collection, PhotoReport, Category, Tag, Tags, File, City, Cities) {
    "use strict";

    var Video = Model.extend({
        urlRoot: '/v1/video',

        defaults: {
            title: null,
            description: null,
            date: null,
            isRecommended: false,
            isFeatured: false
        },

        relations: [
            {
                type: Backbone.Many,
                key: 'relatedVideo',
                relatedModel: Video,
                collectionType: Collection // TODO: Must be a Videos collection, but we have require recursive conflict
            },
            {
                type: Backbone.One,
                key: 'photoReport',
                relatedModel: PhotoReport
            },
            {
                type: Backbone.One,
                key: 'file',
                relatedModel: File
            },
            {
                type: Backbone.One,
                key: 'category',
                relatedModel: Category
            },
            {
                type: Backbone.Many,
                key: 'tags',
                relatedModel: Tag,
                collectionType: Tags
            },
            {
                type: Backbone.One,
                key: 'originCity',
                relatedModel: City
            },
            {
                type: Backbone.Many,
                key: 'cities',
                relatedModel: City,
                collectionType: Cities
            }
        ],

        validation: {
            title: [{
                required: true
            }],

            description: [{
                required: true
            }],

            file: [{
                required: true
            }],

            category: [{
                fn: function(value, attr) {
                    if (!value || (value && !value.id)) {
                        return 'form_validator_required';
                    }
                }
            }],

            tags: [{
                required: true
            }],

            date: [
                {required: true},
                {
                    pattern: /^\d{2}\.\d{2}\.\d{4}$/,
                    msg: 'form_validator_date'
                }
            ],

            cities: [{
                required: true
            }],

            originCity: [{
                fn: function(value, attr) {
                    if (!value || (value && !value.id)) {
                        return 'form_validator_required';
                    }
                }
            }]
    }});

    return Video;
});
define("modules/video/templates/compiled/list/_videos", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, self=this, functionType="function", escapeExpression=this.escapeExpression, helperMissing=helpers.helperMissing;

function program1(depth0,data,depth1) {
  
  var buffer = "", stack1, stack2;
  buffer += "\n    <div class=\"video-item "
    + escapeExpression(((stack1 = depth1['class']),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + " ";
  stack2 = helpers['if'].call(depth0, depth1.showRecommended, {hash:{},inverse:self.noop,fn:self.program(2, program2, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += " ";
  stack2 = helpers['if'].call(depth0, depth0.isRight, {hash:{},inverse:self.noop,fn:self.program(5, program5, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\">\n        <a href=\"#video/";
  if (stack2 = helpers.id) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.id; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "\" class=\"video-item-img-wrapper\">\n            ";
  stack2 = helpers['if'].call(depth0, depth1.showRecommended, {hash:{},inverse:self.noop,fn:self.program(7, program7, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n            ";
  stack2 = helpers.unless.call(depth0, depth1.showRecommended, {hash:{},inverse:self.noop,fn:self.program(12, program12, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n\n            <span class=\"video-item-play\"></span>\n        </a>\n\n        ";
  stack2 = helpers['if'].call(depth0, depth1.showRecommended, {hash:{},inverse:self.noop,fn:self.program(14, program14, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n\n        ";
  stack2 = helpers['if'].call(depth0, depth1.showCategory, {hash:{},inverse:self.noop,fn:self.program(17, program17, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n\n        ";
  stack2 = helpers['if'].call(depth0, depth0.photoReport, {hash:{},inverse:self.noop,fn:self.program(19, program19, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n\n        <a href=\"#video/";
  if (stack2 = helpers.id) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.id; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "\" class=\"video-item-title ";
  stack2 = helpers['if'].call(depth0, depth1.showRecommended, {hash:{},inverse:self.noop,fn:self.program(26, program26, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\">";
  if (stack2 = helpers.title) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.title; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "</a>\n    </div>\n";
  return buffer;
  }
function program2(depth0,data) {
  
  var stack1;
  stack1 = helpers['if'].call(depth0, depth0.isRecommended, {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { return stack1; }
  else { return ''; }
  }
function program3(depth0,data) {
  
  
  return "video-item-recommended";
  }

function program5(depth0,data) {
  
  
  return "isRight";
  }

function program7(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                ";
  stack1 = helpers['if'].call(depth0, depth0.isRecommended, {hash:{},inverse:self.program(10, program10, data),fn:self.program(8, program8, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            ";
  return buffer;
  }
function program8(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                    <img class=\"video-item-img\" src=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.file),stack1 == null || stack1 === false ? stack1 : stack1.cover)),stack1 == null || stack1 === false ? stack1 : stack1.medium)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\">\n                ";
  return buffer;
  }

function program10(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                    <img class=\"video-item-img\" src=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.file),stack1 == null || stack1 === false ? stack1 : stack1.cover)),stack1 == null || stack1 === false ? stack1 : stack1.small)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\">\n                ";
  return buffer;
  }

function program12(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                <img class=\"video-item-img\" src=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.file),stack1 == null || stack1 === false ? stack1 : stack1.cover)),stack1 == null || stack1 === false ? stack1 : stack1.small)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\">\n            ";
  return buffer;
  }

function program14(depth0,data) {
  
  var stack1;
  stack1 = helpers['if'].call(depth0, depth0.isRecommended, {hash:{},inverse:self.noop,fn:self.program(15, program15, data),data:data});
  if(stack1 || stack1 === 0) { return stack1; }
  else { return ''; }
  }
function program15(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n            <div class=\"video-item-recommendedSign\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "recommended", options) : helperMissing.call(depth0, "t", "recommended", options)))
    + "</div>\n            <div class=\"video-item-recommendedBg\"></div>\n        ";
  return buffer;
  }

function program17(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n            <div class=\"video-item-type\"><span class=\"video-item-type-link\">"
    + escapeExpression(((stack1 = ((stack1 = depth0.category),stack1 == null || stack1 === false ? stack1 : stack1.name)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</span></div>\n        ";
  return buffer;
  }

function program19(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n            <div class=\"video-item-info\">\n            ";
  stack1 = helpers['if'].call(depth0, depth0.isRecommended, {hash:{},inverse:self.program(23, program23, data),fn:self.program(20, program20, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            </div>\n        ";
  return buffer;
  }
function program20(depth0,data) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n                ";
  stack2 = helpers['if'].call(depth0, ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place), {hash:{},inverse:self.noop,fn:self.program(21, program21, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                <span class=\"video-item-info-date\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.date || depth0.date),stack1 ? stack1.call(depth0, depth0.date, options) : helperMissing.call(depth0, "date", depth0.date, options)))
    + "</span>\n            ";
  return buffer;
  }
function program21(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                    <a href=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place)),stack1 == null || stack1 === false ? stack1 : stack1.url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" rel=\"external\" class=\"video-item-info-link\">"
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place)),stack1 == null || stack1 === false ? stack1 : stack1.title)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</a>\n                ";
  return buffer;
  }

function program23(depth0,data) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n                ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.date || depth0.date),stack1 ? stack1.call(depth0, depth0.date, options) : helperMissing.call(depth0, "date", depth0.date, options)));
  stack2 = helpers['if'].call(depth0, ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place), {hash:{},inverse:self.noop,fn:self.program(24, program24, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n            ";
  return buffer;
  }
function program24(depth0,data) {
  
  var buffer = "", stack1;
  buffer += ", <a href=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place)),stack1 == null || stack1 === false ? stack1 : stack1.url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" rel=\"external\" class=\"video-item-info-link\">"
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.photoReport),stack1 == null || stack1 === false ? stack1 : stack1.place)),stack1 == null || stack1 === false ? stack1 : stack1.title)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</a>";
  return buffer;
  }

function program26(depth0,data) {
  
  var stack1;
  stack1 = helpers['if'].call(depth0, depth0.isRecommended, {hash:{},inverse:self.noop,fn:self.program(27, program27, data),data:data});
  if(stack1 || stack1 === 0) { return stack1; }
  else { return ''; }
  }
function program27(depth0,data) {
  
  
  return "recommended";
  }

  buffer += "\n\n";
  stack1 = helpers.each.call(depth0, depth0.videos, {hash:{},inverse:self.noop,fn:self.programWithDepth(1, program1, data, depth0),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  return buffer;
  }};});
define("modules/video/templates/compiled/list/list", ["lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n        <div class=\"heading-h2\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, depth0.title, options) : helperMissing.call(depth0, "t", depth0.title, options)))
    + "</div>\n    ";
  return buffer;
  }

function program3(depth0,data) {
  
  
  return "\n        <div class=\"preloader preloader-40 preloader-centered\"></div>\n    ";
  }

  buffer += "\n\n<div class=\"video-items video-items-list\">\n\n    ";
  stack1 = helpers['if'].call(depth0, depth0.title, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n\n    ";
  stack1 = helpers.unless.call(depth0, depth0.isFetched, {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "list", options) : helperMissing.call(depth0, "region", "list", options)))
    + "\n\n</div>";
  return buffer;
  }};});
define("modules/video/templates/compiled/video/admin-panel", function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<a href=\"#video/";
  if (stack1 = helpers.id) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "/edit\" class=\"edit j-edit\"></a>\n<a class=\"delete j-delete\"></a>";
  return buffer;
  }};});
define("modules/video/templates/compiled/video/related", function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function", escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1, stack2;
  buffer += "\n            <a href=\"#video/";
  if (stack1 = helpers.id) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\" class=\"videoPage-related-item j-videoPage-related-item\">\n                <img src=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.file),stack1 == null || stack1 === false ? stack1 : stack1.cover)),stack1 == null || stack1 === false ? stack1 : stack1.small)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" class=\"videoPage-related-item-picture\">\n                <span class=\"videoPage-related-item-shadow\"></span>\n                <span class=\"videoPage-related-item-title\">";
  if (stack2 = helpers.title) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.title; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "</span>\n            </a>\n        ";
  return buffer;
  }

  buffer += "<div class=\"videoPage-related j-scroll\">\n    <div class=\"videoPage-related-scrollBox j-scroll-box\">\n        ";
  stack1 = helpers.each.call(depth0, depth0.video, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </div>\n</div>";
  return buffer;
  }};});
define("modules/video/templates/compiled/video/video", ["lib/style!modules/video/styles/compiled/main", require, "lib/style!modules/tv/styles/compiled/tv/main", require, "lib/locale!modules/video/locales/compiled/", require, "lib/locale!modules/tv/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, stack2, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, functionType="function", self=this;

function program1(depth0,data) {
  
  
  return "notFetched";
  }

function program3(depth0,data) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n                <div class=\"j-player-startPanel videoPage-startPanel ";
  stack1 = helpers['if'].call(depth0, depth0.withBanner, {hash:{},inverse:self.noop,fn:self.program(4, program4, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n                    <img src=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.file)),stack1 == null || stack1 === false ? stack1 : stack1.cover)),stack1 == null || stack1 === false ? stack1 : stack1.large)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" class=\"j-player-startPanel-background videoPage-startPanel-background\" alt=\"\">\n                    ";
  stack2 = helpers['if'].call(depth0, ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.isRecommended), {hash:{},inverse:self.noop,fn:self.program(6, program6, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                    <div class=\"videoPage-startPanel-info\">\n                        <div class=\"videoPage-startPanel-info-title\">"
    + escapeExpression(((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.title)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</div>\n                        <div class=\"videoPage-startPanel-info-bottom\">\n                            <span class=\"videoPage-startPanel-info-elem\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.date || depth0.date),stack1 ? stack1.call(depth0, ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.date), options) : helperMissing.call(depth0, "date", ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.date), options)))
    + "</span>\n                            ";
  stack2 = helpers['if'].call(depth0, ((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.photoReport)),stack1 == null || stack1 === false ? stack1 : stack1.place), {hash:{},inverse:self.noop,fn:self.program(8, program8, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                        </div>\n                    </div>\n                    ";
  stack2 = helpers['if'].call(depth0, depth0.withBanner, {hash:{},inverse:self.noop,fn:self.program(10, program10, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                    <div class=\"videoPage-startPanel-start\">\n                        <div class=\"videoPage-startPanel-play\">\n                            <i class=\"videoPage-play-ico\"></i>\n                        </div>\n                    </div>\n                </div>\n                <div class=\"videoPage-iframeWrapper\">\n                    <img src=\"/img/fake-iframe.gif\" class=\"videoPage-iframeWrapper-img\">\n                    ";
  options = {hash:{
    'url': (((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.embedUrl))
  },data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "player", options) : helperMissing.call(depth0, "region", "player", options)))
    + "\n                </div>\n            ";
  return buffer;
  }
function program4(depth0,data) {
  
  
  return "banner";
  }

function program6(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "\n                        <div class=\"videoPage-startPanel-recommended\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "recommended", options) : helperMissing.call(depth0, "t", "recommended", options)))
    + "</div>\n                    ";
  return buffer;
  }

function program8(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                                <a href=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.photoReport)),stack1 == null || stack1 === false ? stack1 : stack1.place)),stack1 == null || stack1 === false ? stack1 : stack1.url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" rel=\"external\" class=\"videoPage-startPanel-info-elem videoPage-startPanel-info-place\">"
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.photoReport)),stack1 == null || stack1 === false ? stack1 : stack1.place)),stack1 == null || stack1 === false ? stack1 : stack1.title)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</a>\n                            ";
  return buffer;
  }

function program10(depth0,data) {
  
  
  return "\n                    <div class=\"videoPage-bannerWrapper\">\n                        <img class=\"videoPage-banner\" src=\"http://files2.geometria.ru/pics/original/27698706.jpg\">\n                    </div>\n                    ";
  }

function program12(depth0,data) {
  
  
  return "\n                <img src=\"/img/fake-iframe.gif\" class=\"videoPage-iframeWrapper-img\">\n                <!--<span class=\"preloader preloader-40\"></span>-->\n                <span class=\"preloader preloader-104\"></span>\n            ";
  }

function program14(depth0,data) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n            <div class=\"videoPage-social\">\n                <div class=\"videoPage-info-share\"></div>\n                <div class=\"videoPage-info-views\"></div>\n            </div>\n\n            <div class=\"videoPage-content\">\n                <header class=\"videoPage-content-header\">\n                    <span class=\"videoPage-content-header-title\">"
    + escapeExpression(((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.title)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</span>\n                </header>\n\n                <section class=\"videoPage-description\">\n                    ";
  stack2 = ((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.description)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                </section>\n\n                <div class=\"videoPage-info\">\n                    <span class=\"videoPage-info-category\"><a href=\"/";
  if (stack2 = helpers.cityUrlName) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.cityUrlName; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "/tv/"
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.category)),stack1 == null || stack1 === false ? stack1 : stack1.urlName)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" class=\"videoPage-info-category-link\">"
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.category)),stack1 == null || stack1 === false ? stack1 : stack1.name)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</a></span>\n                    <span class=\"videoPage-info-date\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "published", options) : helperMissing.call(depth0, "t", "published", options)))
    + " ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.date || depth0.date),stack1 ? stack1.call(depth0, ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.date), options) : helperMissing.call(depth0, "date", ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.date), options)))
    + "</span>\n                    ";
  stack2 = helpers['if'].call(depth0, ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.author), {hash:{},inverse:self.noop,fn:self.program(15, program15, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n                </div>\n            </div>\n        ";
  return buffer;
  }
function program15(depth0,data) {
  
  var buffer = "", stack1, options;
  buffer += "<span class=\"videoPage-info-author\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "author", options) : helperMissing.call(depth0, "t", "author", options)))
    + ": "
    + escapeExpression(((stack1 = ((stack1 = depth0.video),stack1 == null || stack1 === false ? stack1 : stack1.author)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</span>";
  return buffer;
  }

  buffer += "\n\n<div class=\"wrapper\">\n    <div class=\"wrapper-in\">\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "adminPanel", options) : helperMissing.call(depth0, "region", "adminPanel", options)))
    + "\n        <div class=\"videoPage-iframe ";
  stack2 = helpers.unless.call(depth0, depth0.isFetched, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\">\n            ";
  stack2 = helpers['if'].call(depth0, depth0.isFetched, {hash:{},inverse:self.program(12, program12, data),fn:self.program(3, program3, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n        </div>\n\n        ";
  stack2 = helpers['if'].call(depth0, depth0.isFetched, {hash:{},inverse:self.noop,fn:self.program(14, program14, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n    </div>\n</div>";
  return buffer;
  }};});
define("modules/video/views/list/list", [

    'lib/view',
    'modules/video/collections/videos',
    'ui/infinite-scroll/views/infinite-scroll',
    'lib/template!modules/video/templates/compiled/list/list',
    'lib/template!modules/video/templates/compiled/list/_videos'

], function(View, Videos, InfiniteScrollView, listTemplate, videosPartial) {
    'use strict';

    return View.extend({

        template: listTemplate,

        _fetchOptions: null,

        regions: {
            list: null
        },

        initialize: function() {
            this.collection = new Videos();
            this.collection.fetch(this._getFetchOptions());
            this.listenTo(this.collection, 'fetched', this.render);
        },

        serialize: function() {
            return {
                isFetched: this.collection.isFetched(),
                isEmpty: !this.collection.totalCount,
                title: this.options.title || ''
            };
        },

        afterRender: function() {
            if (this.collection.totalCount === 0) {
                return;
            }

            var showCategory = !this.options.category;

            var infiniteScrollView = new InfiniteScrollView({
                template: videosPartial,
                collection: this.collection,
                fetch : this._getFetchOptions(),
                serialize: function(collection) {
                    return {
                        videos: collection.toArrangedJSON(this.offset > 0), // TODO: Fix dirty hack
                        showCategory: showCategory,
                        showRecommended: true
                    };
                }
            });

            this.getRegion('list').show(infiniteScrollView);
        },

        _getFetchOptions: function() {
            if (!this._fetchOptions) {
                this._fetchOptions = {
                    data : {
                        cityId: this.options.city.get('id'),
                        _fields: 'id,title,date,isRecommended,file(cover),photoReport(place(title,url))',
                        limit: 50
                    }
                };

                if (this.options.sort) {
                    this._fetchOptions.data.sort = this.options.sort;
                }

                if (this.options.category) {
                    this._fetchOptions.data.categoryId = this.options.category.get('id');
                    this._fetchOptions.data._fields += ',category';
                }

                if (this.options.tag) {
                    this._fetchOptions.data.tagId = this.options.tag.get('id');
                }
            }

            return this._fetchOptions;
        }
    });
});
define("modules/video/views/video/admin-panel", [

    'underscore',
    'lib/view',
    'lib/template!modules/video/templates/compiled/video/admin-panel',
    'modules/common/models/current-city',
    'modules/common/models/current-user',
    'modules/video/models/video',
    'modules/common/views/popup',
    'modules/common/views/flash-message',
    'lib/history/popup'

], function(_, View, adminPanelTemplate, currentCity, currentUser, Video, popupView, flashMessageView, popupHistory) {
    "use strict";

    return View.extend({
        template: adminPanelTemplate,

        className: 'admin-panel',

        events: {
            'click .j-delete': '_delete'
        },

        initialize: function() {
            //todo if currentCity is not fetched ?
            currentUser.isTvManager().done(_.bind(this.render, this));
        },

        serialize: function() {
            var data = {
                isFetched: this.model.isFetched()
            };

            if (data.isFetched) {
                data.id = this.model.get('id');
            }

            return data;
        },

        _delete: function(e) {
            if (confirm('Вы действительно собираетесь удалить это видео?')) {
                e.preventDefault();

                this.model.destroy()
                    .done(_.bind(function() {
                        flashMessageView.success('modules/video/locales/compiled/video_delete_success');
                        popupHistory.navigate('', {replace: true, trigger: true});

                        //todo обновить списки видео
                    }, this))
                    .fail(_.bind(function() {
                        flashMessageView.error('modules/video/locales/compiled/video_delete_error');
                    }, this));
            }
        }
    });

});
define("modules/video/views/video/related", [

    'lib/view',
    'lib/template!modules/video/templates/compiled/video/related',
    'sly'

], function(View, relatedTemplate, Sly) {
    "use strict";

    return View.extend({
        template: relatedTemplate,
        className: 'videoPage-relatedWrapper',

        afterRender: function() {
            this.__$scroll = this.$el.find('.j-scroll');

            if (this.__$scroll.length) {
                this.__$scroll.sly({
                    //TODO: make native for opera
                    horizontal: 1,
                    mouseDragging: 1,
                    touchDragging: 1,
                    dragHandle: 1,
                    clickBar: 1,
                    dynamicHandle: 1,
                    smart: 1,
                    releaseSwing: 1,
                    speed: 100,
                    elasticBounds: 1,
                    itemNav: 'basic',
                    itemSelector: '.j-videoPage-related-item'
                });
            }
        },

        serialize: function() {
            return {
                video: this.collection.toJSON()
            };
        }
    });

});
define("modules/video/views/video/video", [

    'underscore',
    'lib/view',
    'lib/template!modules/video/templates/compiled/video/video',
    'ui/video-player/views/video-player',
    'modules/video/views/video/admin-panel',
    'modules/common/models/current-user',
    'modules/common/models/current-city'

], function(_, View, videoTemplate, VideoPlayerView, AdminPanelView, currentUser, currentCity) {
    "use strict";

    return View.extend({
        template: videoTemplate,

        regions: {
            player: VideoPlayerView,
            adminPanel: null
        },

        events: {
            'click .j-player-startPanel': '_playVideo'
        },

        initialize: function() {
            this.listenTo(this.model, 'fetched', function() {
                this.render();
                this._loadImg();
            });
        },

        afterRender: function() {
            if (this.model.isFetched()) {
                currentUser.isTvManager().done(_.bind(function() {
                    this.getRegion('adminPanel').show(new AdminPanelView({ nested: { model: this.model }}));
                }, this));
            }
        },

        _playVideo: function(e) {
            this.getRegion('player').currentView.play();
            $(e.currentTarget).fadeOut(500);
        },

        serialize: function() {
            return {
                isFetched: this.model.isFetched(),
                video: this.model.toJSON(),
                cityUrlName: currentCity.get('urlName')
            };
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
        }
    });
});


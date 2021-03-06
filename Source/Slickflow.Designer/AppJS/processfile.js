﻿/*
* Slickflow 工作流引擎遵循LGPL协议，也可联系作者商业授权并获取技术支持；
* 除此之外的使用则视为不正当使用，请您务必避免由此带来的商业版权纠纷。

The Slickflow Designer project.
Copyright (C) 2014  .NET Workflow Engine Library

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, you can access the official
web page about lgpl: https://www.gnu.org/licenses/lgpl.html
*/

var processFileManager;
if (!processFileManager) processFileManager = {};

(function () {
    processFileManager.queryProcessFile = function (query, func) {
        jshelper.ajaxPost('/SfApi/api/Wf2Xml/QueryProcessFile',
            JSON.stringify(query),
            function(result){
                func(result);
            }
        );
    }

    processFileManager.saveProcessFile = function (entity) {
        jshelper.ajaxPost('/SfApi/api/Wf2Xml/SaveProcessFile', JSON.stringify(entity), function (result) {
            if (result.Status == "1") {
                alert("保存成功！");
            }
        });
    }
})()


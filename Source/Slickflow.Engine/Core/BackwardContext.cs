﻿/*
* Slickflow 工作流引擎遵循LGPL协议，也可联系作者商业授权并获取技术支持；
* 除此之外的使用则视为不正当使用，请您务必避免由此带来的商业版权纠纷。
* 
The Slickflow project.
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

using System;
using System.Threading;
using System.Data.Linq;
using System.Transactions;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Slickflow.Engine.Common;
using Slickflow.Engine.Utility;
using Slickflow.Engine.Business.Entity;
using Slickflow.Engine.Xpdl;


namespace Slickflow.Engine.Core
{
    /// <summary>
    /// 流程回退处理时的上下文对象
    /// </summary>
    internal class BackwardContext
    {
        internal ActivityEntity BackwardToTaskActivity { get; set; }
        internal ActivityInstanceEntity BackwardToTaskActivityInstance { get; set; }
        internal ActivityEntity BackwardFromActivity { get; set; }
        internal ActivityInstanceEntity BackwardFromActivityInstance { get; set; }
        internal ProcessInstanceEntity ProcessInstance { get; set; }
        internal String BackwardToTargetTransitionGUID { get; set; }
        internal WfBackwardTaskReciever BackwardTaskReciever { get; set; }
        internal ActivityResource ActivityResource { get; set; }
    }
}

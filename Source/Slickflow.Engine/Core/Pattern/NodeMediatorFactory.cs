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
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Reflection;
using Slickflow.Engine.Common;
using Slickflow.Engine.Utility;
using Slickflow.Data;


namespace Slickflow.Engine.Core.Pattern
{
    /// <summary>
    /// 节点执行器的工厂类
    /// </summary>
    internal class NodeMediatorFactory
    {
        /// <summary>
        /// 创建节点执行器的抽象类
        /// </summary>
        /// <param name="processInstance"></param>
        /// <param name="activity"></param>
        /// <param name="activityResource"></param>
        /// <param name="dataContext"></param>
        /// <returns></returns>
        internal static NodeMediator CreateNodeMediator(ActivityForwardContext forwardContext,
            IDbSession session)
        {
            if (forwardContext.Activity.ActivityType == ActivityTypeEnum.StartNode)
            {
                return new NodeMediatorStart(forwardContext, session);
            }
            else if (forwardContext.Activity.ActivityType == ActivityTypeEnum.TaskNode)
            {
                //加签节点特殊处理
                if (forwardContext.Activity.ActivityTypeDetail.ComplexType == Xpdl.ComplexTypeEnum.SignForward)
                {
                    //加签的动态变量传入
                    if (forwardContext.ActivityResource.DynamicVariables != null 
                        && !string.IsNullOrEmpty(forwardContext.ActivityResource.DynamicVariables["SignForwardType"]))
                    {
                        return new NodeMediatorSignForward(forwardContext, session);
                    }
                    else
                    {
                        return new NodeMediatorTask(forwardContext, session);
                    }
                }
                else
                    return new NodeMediatorTask(forwardContext, session);
            }
            else if (forwardContext.Activity.ActivityType == ActivityTypeEnum.SubProcessNode)
            {
                return new NodeMediatorSubProcess(forwardContext, session);
            }
            else
            {
                throw new ApplicationException(string.Format("不明确的节点类型: {0}", forwardContext.Activity.ActivityType.ToString()));
            }
                
        }
    }
}
